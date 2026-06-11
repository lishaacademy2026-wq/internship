const Quiz = require("../models/Quiz");
const Course = require("../models/Course");
const User = require("../models/User");
const Enrollment = require("../models/Enrollment");
const { sendNotificationEmail } = require("../utils/email");

// Get all quizzes for a course (instructor view)
const getQuizzes = async (req, res) => {
  try {
    const { courseId } = req.params;
    const instructorId = req.user._id;

    // Verify instructor owns the course
    const course = await Course.findById(courseId);
    if (!course || course.instructor.toString() !== instructorId.toString()) {
      return res.status(403).json({ message: "Not authorized to view these quizzes" });
    }

    const quizzes = await Quiz.find({ course: courseId })
      .populate("instructor", "fullName email")
      .sort({ createdAt: -1 });

    res.json({ quizzes });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get instructor's quizzes
const getMyQuizzes = async (req, res) => {
  try {
    const instructorId = req.user._id;

    const quizzes = await Quiz.find({ instructor: instructorId })
      .populate("course", "title")
      .populate("instructor", "fullName email")
      .sort({ createdAt: -1 });

    res.json({ quizzes });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get quizzes for student (only enrolled courses)
const getStudentQuizzes = async (req, res) => {
  try {
    const studentId = req.user._id;

    // Get all courses student is enrolled in
    const enrollments = await Enrollment.find({
      student: studentId,
      status: { $in: ["enrolled", "active", "completed"] },
    }).populate("course");

    const courseIds = enrollments.map((e) => e.course._id);

    // Get all quizzes for those courses
    const quizzes = await Quiz.find({ course: { $in: courseIds } })
      .populate("course", "title")
      .populate("instructor", "fullName email")
      .sort({ createdAt: -1 });

    // Add submission info for each quiz
    const quizzesWithSubmissions = quizzes.map((quiz) => {
      const submission = quiz.submissions.find(
        (sub) => sub.student.toString() === studentId.toString()
      );
      return {
        ...quiz.toObject(),
        submissions: submission ? [submission] : [],
      };
    });

    res.json({ quizzes: quizzesWithSubmissions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get quiz by ID (without questions for instructor creation view)
const getQuizById = async (req, res) => {
  try {
    const { id } = req.params;
    const quiz = await Quiz.findById(id)
      .populate("instructor", "fullName email")
      .populate("submissions.gradedBy", "fullName");

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    res.json({ quiz });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get quiz for student (without showing correct answers before submission)
const getStudentQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const studentId = req.user._id;

    const quiz = await Quiz.findById(quizId)
      .populate("instructor", "fullName email");

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Check if student is enrolled in the course
    const enrollment = await Enrollment.findOne({
      student: studentId,
      course: quiz.course,
      status: { $in: ["enrolled", "active", "completed"] },
    });

    if (!enrollment) {
      return res.status(403).json({ message: "You are not enrolled in this course" });
    }

    // Check if deadline has passed
    if (quiz.dueDate && new Date() > new Date(quiz.dueDate)) {
      const studentSubmission = quiz.submissions.find(
        (sub) => sub.student.toString() === studentId.toString()
      );
      if (!studentSubmission) {
        return res.json({
          quiz: {
            id: quiz._id,
            title: quiz.title,
            description: quiz.description,
            dueDate: quiz.dueDate,
            isLate: true,
            message: `Quiz deadline has passed (${new Date(quiz.dueDate).toLocaleString()}). Late submissions are not allowed.`,
            questions: [],
          },
        });
      }
    }

    // Check if student already submitted
    const studentSubmission = quiz.submissions.find(
      (sub) => sub.student.toString() === studentId.toString()
    );

    // If student already submitted and maxAttempts is 1, prevent retake
    if (studentSubmission && quiz.maxAttempts === 1) {
      return res.json({
        quiz: {
          id: quiz._id,
          title: quiz.title,
          description: quiz.description,
          dueDate: quiz.dueDate,
          alreadySubmitted: true,
          submission: studentSubmission,
          questions: [], // Don't send questions if already submitted
        },
      });
    }

    // Return quiz with questions but without correct answers
    const questionsWithoutAnswers = quiz.questions.map((q) => ({
      _id: q._id,
      question: q.question,
      options: q.options,
      // correctIndex is hidden until submission
    }));

    res.json({
      quiz: {
        id: quiz._id,
        title: quiz.title,
        description: quiz.description,
        dueDate: quiz.dueDate,
        passingScore: quiz.passingScore,
        maxAttempts: quiz.maxAttempts,
        instructor: quiz.instructor,
        questions: questionsWithoutAnswers,
        submission: studentSubmission || null,
        alreadySubmitted: !!studentSubmission,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create quiz
const createQuiz = async (req, res) => {
  try {
    const {
      courseId,
      title,
      description,
      questions,
      passingScore,
      maxAttempts,
      dueDate,
    } = req.body;
    const instructorId = req.user._id;

    if (!title || !courseId || !questions || questions.length === 0) {
      return res
        .status(400)
        .json({ message: "Title, courseId, and at least one question are required" });
    }

    // Verify instructor owns the course
    const course = await Course.findById(courseId);
    if (!course || course.instructor.toString() !== instructorId.toString()) {
      return res.status(403).json({ message: "Not authorized to create quiz for this course" });
    }

    const quiz = await Quiz.create({
      course: courseId,
      title,
      description,
      questions,
      passingScore: passingScore || 70,
      maxAttempts: maxAttempts || 1,
      dueDate,
      instructor: instructorId,
      submissions: [],
    });

    const populatedQuiz = await quiz.populate("instructor", "fullName email");

    res.status(201).json({
      quiz: populatedQuiz,
      message: "Quiz created successfully",
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update quiz
const updateQuiz = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, questions, passingScore, maxAttempts, dueDate } = req.body;

    const quiz = await Quiz.findById(id);
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    if (quiz.instructor.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to update this quiz" });
    }

    if (title) quiz.title = title;
    if (description !== undefined) quiz.description = description;
    if (questions) quiz.questions = questions;
    if (passingScore !== undefined) quiz.passingScore = passingScore;
    if (maxAttempts !== undefined) quiz.maxAttempts = maxAttempts;
    if (dueDate) quiz.dueDate = dueDate;

    await quiz.save();
    const updated = await quiz.populate("instructor", "fullName email");

    res.json({
      quiz: updated,
      message: "Quiz updated successfully",
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete quiz
const deleteQuiz = async (req, res) => {
  try {
    const { id } = req.params;
    const quiz = await Quiz.findById(id);

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    if (quiz.instructor.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to delete this quiz" });
    }

    await Quiz.findByIdAndDelete(id);

    res.json({ message: "Quiz deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Submit quiz - student submits answers
const submitQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const { answers } = req.body; // Array of selected option indexes
    const studentId = req.user._id;
    const studentName = req.user.fullName;
    const studentEmail = req.user.email;

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ message: "Answers array is required" });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Check if deadline has passed
    if (quiz.dueDate && new Date() > new Date(quiz.dueDate)) {
      return res.status(400).json({
        message: `Quiz deadline has passed (${new Date(quiz.dueDate).toLocaleString()}). Late submissions are not allowed.`,
      });
    }

    // Check if student is enrolled in the course
    const enrollment = await Enrollment.findOne({
      student: studentId,
      course: quiz.course,
      status: { $in: ["enrolled", "active", "completed"] },
    });

    if (!enrollment) {
      return res.status(403).json({ message: "You are not enrolled in this course" });
    }

    // Check if student already submitted and maxAttempts is 1 (no retakes)
    const existingSubmission = quiz.submissions.find(
      (sub) => sub.student.toString() === studentId.toString()
    );

    if (existingSubmission && quiz.maxAttempts === 1) {
      return res.status(400).json({
        message: "You have already submitted this quiz. Retakes are not allowed.",
      });
    }

    // Calculate score
    let correctCount = 0;
    answers.forEach((answer, index) => {
      if (quiz.questions[index] && quiz.questions[index].correctIndex === answer) {
        correctCount++;
      }
    });

    const score = Math.round((correctCount / quiz.questions.length) * 100);
    const passed = score >= quiz.passingScore;

    if (existingSubmission) {
      // Update existing submission (for retake scenarios)
      existingSubmission.answers = answers;
      existingSubmission.score = score;
      existingSubmission.passed = passed;
      existingSubmission.canViewAnswers = true;
      existingSubmission.submittedAt = new Date();
      existingSubmission.updatedAt = new Date();
    } else {
      // Create new submission
      quiz.submissions.push({
        student: studentId,
        studentName,
        studentEmail,
        answers,
        score,
        passed,
        canViewAnswers: true, // Allow student to see answers after submission
        submittedAt: new Date(),
        updatedAt: new Date(),
      });
    }

    await quiz.save();

    const submission = quiz.submissions.find(
      (sub) => sub.student.toString() === studentId.toString()
    );

    // Notify instructor
    const instructor = await User.findById(quiz.instructor);
    if (instructor) {
      await sendNotificationEmail(
        instructor.email,
        "Quiz Submission",
        `${studentName} submitted the quiz "${quiz.title}" at ${new Date().toLocaleString()}. Score: ${score}%`
      );
    }

    // Return score and passed status, along with correct answers
    const questionsWithAnswers = quiz.questions.map((q, index) => ({
      _id: q._id,
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      studentAnswer: answers[index],
      isCorrect: answers[index] === q.correctIndex,
    }));

    res.json({
      message: "Quiz submitted successfully",
      score,
      passed,
      totalQuestions: quiz.questions.length,
      correctAnswers: correctCount,
      passingScore: quiz.passingScore,
      questionsWithAnswers, // Student can now see correct answers
      submission,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Get quiz submissions for instructor
const getSubmissions = async (req, res) => {
  try {
    const { quizId } = req.params;

    const quiz = await Quiz.findById(quizId)
      .populate("submissions.student", "fullName email username");

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Only instructor or admin can view submissions
    if (
      quiz.instructor.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ message: "Not authorized to view these submissions" });
    }

    res.json({
      submissions: quiz.submissions.map((sub) => ({
        _id: sub._id,
        student: sub.student,
        studentName: sub.studentName,
        studentEmail: sub.studentEmail,
        score: sub.score,
        passed: sub.passed,
        submittedAt: sub.submittedAt,
        updatedAt: sub.updatedAt,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get quiz result with correct answers
const getQuizResult = async (req, res) => {
  try {
    const { quizId } = req.params;
    const studentId = req.user._id;

    const quiz = await Quiz.findById(quizId)
      .populate("instructor", "fullName email");

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    const submission = quiz.submissions.find(
      (sub) => sub.student.toString() === studentId.toString()
    );

    if (!submission) {
      return res.status(404).json({ message: "You have not submitted this quiz yet" });
    }

    // Return quiz with answers and correct answers
    const questionsWithAnswers = quiz.questions.map((q, index) => ({
      _id: q._id,
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      studentAnswer: submission.answers[index],
      isCorrect: submission.answers[index] === q.correctIndex,
    }));

    res.json({
      quiz: {
        id: quiz._id,
        title: quiz.title,
        description: quiz.description,
        instructor: quiz.instructor,
      },
      result: {
        score: submission.score,
        passed: submission.passed,
        totalQuestions: quiz.questions.length,
        correctAnswers: submission.answers.filter(
          (ans, idx) => ans === quiz.questions[idx].correctIndex
        ).length,
        passingScore: quiz.passingScore,
        submittedAt: submission.submittedAt,
      },
      questionsWithAnswers,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all my quiz submissions
const getMySubmissions = async (req, res) => {
  try {
    const studentId = req.user._id;

    const quizzes = await Quiz.find({
      "submissions.student": studentId,
    })
      .populate("instructor", "fullName email")
      .populate("course", "title");

    const submissions = quizzes
      .map((quiz) => ({
        quizId: quiz._id,
        courseTitle: quiz.course?.title,
        title: quiz.title,
        dueDate: quiz.dueDate,
        instructor: quiz.instructor,
        submission: quiz.submissions.find(
          (sub) => sub.student.toString() === studentId.toString()
        ),
      }))
      .filter((item) => item.submission);

    res.json({ submissions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getQuizzes,
  getMyQuizzes,
  getStudentQuizzes,
  getQuizById,
  getStudentQuiz,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  submitQuiz,
  getSubmissions,
  getQuizResult,
  getMySubmissions,
};