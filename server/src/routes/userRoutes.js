const express = require("express");
const { getDoctors, getDoctorById, getUsers, deleteUser } = require("../controllers/userController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.get("/doctors", getDoctors);
router.get("/doctors/:id", getDoctorById);
router.get("/", authorize("admin"), getUsers);
router.delete("/:id", authorize("admin"), deleteUser);

module.exports = router;
