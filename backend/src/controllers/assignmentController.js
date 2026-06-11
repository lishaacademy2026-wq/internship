const Assignment = require("../models/Assignment");
const User = require("../models/User");
const { sendNotificationEmail } = require("../utils/email");

// Get all assignments for a course (instructor view)
const getAssignments = async (req, res) => {
  try {
    const { courseId } = req.params;
    const assignments = await Assignment.find({ course: courseId })
      .populate("instructor", "fullName email")
      .sort({ createdAt: -1 });

    res.json({ assignments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get specific assignment with submissions
const getAssignmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const assignment = await Assignment.findById(id)
      .populate("instructor", "fullName email")
      .populate("submissions.student", "fullName email username");

    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    res.json({ assignment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get assignment for student (with only their submission)
const getStudentAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const studentId = req.user._id;

    const assignment = await Assignment.findById(assignmentId)
      .populate("instructor", "fullName email");

    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    // Find student's submission
    const studentSubmission = assignment.submissions.find(
      (sub) => sub.student.toString() === studentId.toString()
    );

    res.json({
      assignment: {
        id: assignment._id,
        title: assignment.title,
        description: assignment.description,
        deadline: assignment.deadline,
        maxScore: assignment.maxScore,
        instructor: assignment.instructor,
        submission: studentSubmission || null,
      },
    });
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

// Update assignment (can be edited by instructor/admin even after creation)
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
        `${studentName} submitted an assignment: "${assignment.title}"`
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
  getAssignmentById,
  getStudentAssignment,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  submitAssignment,
  gradeSubmission,
  getSubmissions,
  getMySubmissions,
};
