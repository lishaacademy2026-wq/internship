const Assignment = require("../models/Assignment");
const Course = require("../models/Course");
const User = require("../models/User");
const Enrollment = require("../models/Enrollment");
const { sendNotificationEmail } = require("../utils/email");

// Get all assignments for a course (instructor view)
const getAssignments = async (req, res) => {
  try {
    const { courseId } = req.params;
    const instructorId = req.user._id;

    // Verify instructor owns the course
    const course = await Course.findById(courseId);
    if (!course || course.instructor.toString() !== instructorId.toString()) {
      return res.status(403).json({ message: "Not authorized to view these assignments" });
    }

    const assignments = await Assignment.find({ course: courseId })
      .populate("instructor", "fullName email")
      .sort({ createdAt: -1 });

    res.json({ assignments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get instructor's courses with assignments
const getMyAssignments = async (req, res) => {
  try {
    const instructorId = req.user._id;

    const assignments = await Assignment.find({ instructor: instructorId })
      .populate("course", "title")
      .populate("instructor", "fullName email")
      .sort({ createdAt: -1 });

    res.json({ assignments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get assignments for student (only enrolled courses)
const getStudentAssignments = async (req, res) => {
  try {
    const studentId = req.user._id;

    // Get all courses student is enrolled in
    const enrollments = await Enrollment.find({
      student: studentId,
      status: { $in: ["enrolled", "active", "completed"] },
    }).populate("course");

    const courseIds = enrollments.map((e) => e.course._id);

    // Get all assignments for those courses
    const assignments = await Assignment.find({ course: { $in: courseIds } })
      .populate("course", "title")
      .populate("instructor", "fullName email")
      .sort({ createdAt: -1 });

    // Add submission info for each assignment
    const assignmentsWithSubmissions = assignments.map((assignment) => {
      const submission = assignment.submissions.find(
        (sub) => sub.student.toString() === studentId.toString()
      );
      return {
        ...assignment.toObject(),
        submissions: submission ? [submission] : [],
      };
    });

    res.json({ assignments: assignmentsWithSubmissions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create assignment
const createAssignment = async (req, res) => {
  try {
    const { courseId, title, description, deadline, maxScore } = req.body;
    const instructorId = req.user._id;

    if (!title || !courseId) {
      return res.status(400).json({ message: "Title and courseId are required" });
    }

    // Verify instructor owns the course
    const course = await Course.findById(courseId);
    if (!course || course.instructor.toString() !== instructorId.toString()) {
      return res.status(403).json({ message: "Not authorized to create assignment for this course" });
    }

    const assignment = await Assignment.create({
      course: courseId,
      title,
      description,
      deadline,
      maxScore: maxScore || 100,
      instructor: instructorId,
      submissions: [],
    });

    const populatedAssignment = await assignment
      .populate("course", "title")
      .populate("instructor", "fullName email")
      .execPopulate();

    res.status(201).json({
      assignment: populatedAssignment,
      message: "Assignment created successfully",
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update assignment
const updateAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, deadline, maxScore } = req.body;

    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    // Only instructor or admin can update
    if (
      assignment.instructor.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ message: "Not authorized to update this assignment" });
    }

    if (title) assignment.title = title;
    if (description !== undefined) assignment.description = description;
    if (deadline) assignment.deadline = deadline;
    if (maxScore) assignment.maxScore = maxScore;

    await assignment.save();
    const updated = await assignment.populate("instructor", "fullName email");

    res.json({
      assignment: updated,
      message: "Assignment updated successfully",
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete assignment
const deleteAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const assignment = await Assignment.findById(id);

    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    if (
      assignment.instructor.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ message: "Not authorized to delete this assignment" });
    }

    await Assignment.findByIdAndDelete(id);

    res.json({ message: "Assignment deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Student submits assignment
const submitAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { content, fileUrl } = req.body;
    const studentId = req.user._id;
    const studentName = req.user.fullName;
    const studentEmail = req.user.email;

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    // Check if deadline has passed
    if (assignment.deadline && new Date() > new Date(assignment.deadline)) {
      return res.status(400).json({
        message: `Assignment deadline has passed (${new Date(assignment.deadline).toLocaleString()}). Late submissions are not allowed.`,
      });
    }

    // Check if student is enrolled in the course
    const enrollment = await Enrollment.findOne({
      student: studentId,
      course: assignment.course,
      status: { $in: ["enrolled", "active", "completed"] },
    });

    if (!enrollment) {
      return res.status(403).json({ message: "You are not enrolled in this course" });
    }

    // Check if student already submitted
    const existingSubmission = assignment.submissions.find(
      (sub) => sub.student.toString() === studentId.toString()
    );

    if (existingSubmission && !assignment.allowResubmit) {
      return res.status(400).json({ message: "You have already submitted this assignment" });
    }

    if (existingSubmission) {
      // Update existing submission
      existingSubmission.content = content || "";
      existingSubmission.fileUrl = fileUrl || "";
      existingSubmission.submittedAt = new Date();
      existingSubmission.status = "pending";
      existingSubmission.score = undefined;
      existingSubmission.feedback = "";
    } else {
      // Create new submission
      assignment.submissions.push({
        student: studentId,
        studentName,
        studentEmail,
        content: content || "",
        fileUrl: fileUrl || "",
        submittedAt: new Date(),
        status: "pending",
      });
    }

    await assignment.save();

    // Notify instructor
    const instructor = await User.findById(assignment.instructor);
    if (instructor) {
      await sendNotificationEmail(
        instructor.email,
        "New Assignment Submission",
        `${studentName} submitted an assignment: "${assignment.title}" at ${new Date().toLocaleString()}`
      );
    }

    res.json({
      message: "Assignment submitted successfully",
      submission: assignment.submissions.find(
        (sub) => sub.student.toString() === studentId.toString()
      ),
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Grade assignment submission
const gradeSubmission = async (req, res) => {
  try {
    const { assignmentId, submissionId } = req.params;
    const { score, feedback } = req.body;

    if (score === undefined || score === null) {
      return res.status(400).json({ message: "Score is required" });
    }

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    // Only instructor or admin can grade
    if (
      assignment.instructor.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ message: "Not authorized to grade this assignment" });
    }

    const submission = assignment.submissions.id(submissionId);
    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    submission.score = score;
    submission.feedback = feedback || "";
    submission.status = "graded";
    submission.gradedAt = new Date();
    submission.gradedBy = req.user._id;

    await assignment.save();

    // Notify student about grading
    const student = await User.findById(submission.student);
    if (student) {
      await sendNotificationEmail(
        student.email,
        "Assignment Graded",
        `Your assignment "${assignment.title}" has been graded. Score: ${score}/${assignment.maxScore}`
      );
    }

    res.json({
      message: "Submission graded successfully",
      submission,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Get submissions for instructor
const getSubmissions = async (req, res) => {
  try {
    const { assignmentId } = req.params;

    const assignment = await Assignment.findById(assignmentId)
      .populate("submissions.student", "fullName email username")
      .populate("submissions.gradedBy", "fullName");

    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    // Only instructor or admin can view submissions
    if (
      assignment.instructor.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ message: "Not authorized to view these submissions" });
    }

    res.json({
      submissions: assignment.submissions,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get student's all submissions
const getMySubmissions = async (req, res) => {
  try {
    const studentId = req.user._id;

    const assignments = await Assignment.find({
      "submissions.student": studentId,
    })
      .populate("instructor", "fullName email")
      .populate("course", "title");

    const submissions = assignments
      .map((assignment) => ({
        assignmentId: assignment._id,
        courseTitle: assignment.course?.title,
        title: assignment.title,
        deadline: assignment.deadline,
        instructor: assignment.instructor,
        submission: assignment.submissions.find(
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
  getAssignments,
  getMyAssignments,
  getStudentAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  submitAssignment,
  gradeSubmission,
  getSubmissions,
  getMySubmissions,
};