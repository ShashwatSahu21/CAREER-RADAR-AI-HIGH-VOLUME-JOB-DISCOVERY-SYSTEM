import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding CareerPilot AI Master Career Database with updated resume...");

  const hash = await bcrypt.hash("admin123", 12);

  // 1. Create User
  const user = await prisma.user.upsert({
    where: { email: "Shashwatsahu.contact@gmail.com" },
    update: { name: "Shashwat Sahu" },
    create: {
      email: "Shashwatsahu.contact@gmail.com",
      name: "Shashwat Sahu",
      passwordHash: hash,
    },
  });

  // 2. Create User Settings
  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      aiProvider: "gemini",
      highPriorityMin: 85,
      strongMatchMin: 70,
      stretchMatchMin: 55,
      smtpServer: "smtp.gmail.com",
      smtpPort: 587,
      smtpUsername: "Shashwatsahu.contact@gmail.com",
      destinationEmail: "Shashwatsahu.contact@gmail.com",
    },
  });

  // 3. Create Master Career Profile
  const profile = await prisma.careerProfile.upsert({
    where: { userId: user.id },
    update: {
      fullName: "Shashwat Sahu",
      email: "Shashwatsahu.contact@gmail.com",
      phone: "+91 8827999403",
      location: "Bengaluru, India",
      linkedinUrl: "https://www.linkedin.com/in/shashwatsahu21",
      githubUrl: "https://github.com/ShashwatSahu21",
      portfolioUrl: "https://shashwatsahu-portfolio-website.vercel.app/",
      summary: "Robotics & AI Engineer specializing in Physical AI, Autonomous Systems, ROS2, Embedded Control Architectures, and Technical Product Management.",
    },
    create: {
      userId: user.id,
      fullName: "Shashwat Sahu",
      email: "Shashwatsahu.contact@gmail.com",
      phone: "+91 8827999403",
      location: "Bengaluru, India",
      linkedinUrl: "https://www.linkedin.com/in/shashwatsahu21",
      githubUrl: "https://github.com/ShashwatSahu21",
      portfolioUrl: "https://shashwatsahu-portfolio-website.vercel.app/",
      summary: "Robotics & AI Engineer specializing in Physical AI, Autonomous Systems, ROS2, Embedded Control Architectures, and Technical Product Management.",
    },
  });

  // 4. Create Education
  await prisma.education.deleteMany({ where: { profileId: profile.id } });
  await prisma.education.create({
    data: {
      profileId: profile.id,
      degree: "B.E. Robotics & Artificial Intelligence",
      specialization: "Robotics & Artificial Intelligence",
      university: "Bangalore Institute of Technology, Bengaluru",
      graduationDate: "2027",
      cgpa: "2023–2027",
      coursework: JSON.stringify(["Robotics", "Artificial Intelligence", "Physical AI", "Autonomous Systems", "Embedded Systems", "Computer Vision", "Control Systems"]),
    },
  });

  // 5. Create Experiences & Verified Bullets
  await prisma.experienceBullet.deleteMany({ where: { experience: { profileId: profile.id } } });
  await prisma.experience.deleteMany({ where: { profileId: profile.id } });

  const exp1 = await prisma.experience.create({
    data: {
      profileId: profile.id,
      company: "Incanto Dynamics",
      role: "AI & Robotics Operations Manager Intern",
      startDate: "2025",
      endDate: "Present",
      location: "Bengaluru, India",
      employmentType: "internship",
      technologies: JSON.stringify(["Robotics", "AI-driven Systems", "System Validation", "Deployment", "Robotic Workflows"]),
      domains: JSON.stringify(["Robotics", "Physical AI", "Operations"]),
    },
  });
  await prisma.experienceBullet.createMany({
    data: [
      {
        experienceId: exp1.id,
        content: "Supported testing, integration, and operational deployment of robotics and AI-driven systems in real-world environments.",
        isVerified: true,
        sortOrder: 0,
      },
      {
        experienceId: exp1.id,
        content: "Worked across system validation, deployment, and technical operations; contributed to evaluating and improving the reliability of integrated robotic workflows.",
        isVerified: true,
        sortOrder: 1,
      },
    ],
  });

  const exp2 = await prisma.experience.create({
    data: {
      profileId: profile.id,
      company: "Tech Analogy",
      role: "Robotics Intern",
      startDate: "2024",
      endDate: "2025",
      location: "India",
      employmentType: "internship",
      technologies: JSON.stringify(["ROS", "Robotic Automation", "Software Simulation", "System Integration"]),
      domains: JSON.stringify(["Robotics", "ROS", "Automation"]),
    },
  });
  await prisma.experienceBullet.createMany({
    data: [
      {
        experienceId: exp2.id,
        content: "Worked on robotic automation and software simulation, contributing to the development and evaluation of robotics workflows.",
        isVerified: true,
        sortOrder: 0,
      },
      {
        experienceId: exp2.id,
        content: "Gained hands-on exposure to ROS-based system integration and robotics software environments.",
        isVerified: true,
        sortOrder: 1,
      },
    ],
  });

  const exp3 = await prisma.experience.create({
    data: {
      profileId: profile.id,
      company: "AIESEC in India",
      role: "Senior Product Manager",
      startDate: "2024",
      endDate: "2025",
      location: "India",
      employmentType: "leadership",
      technologies: JSON.stringify(["Funnel Optimization", "Workflow Optimization", "Data-driven Iteration", "Agile"]),
      domains: JSON.stringify(["Product Management", "Growth"]),
    },
  });
  await prisma.experienceBullet.createMany({
    data: [
      {
        experienceId: exp3.id,
        content: "Engineered and optimized acquisition and conversion workflows, generating ₹1.6L in direct value and contributing toward a ₹5.4L entity-wide milestone.",
        isVerified: true,
        sortOrder: 0,
      },
      {
        experienceId: exp3.id,
        content: "Improved funnel efficiency by 35% and conversion performance by 40% through experimentation, workflow optimization, and data-driven iteration; led a 5-member cross-functional team.",
        isVerified: true,
        sortOrder: 1,
      },
    ],
  });

  const exp4 = await prisma.experience.create({
    data: {
      profileId: profile.id,
      company: "1Stop.ai",
      role: "Artificial Intelligence Intern",
      startDate: "Apr 2024",
      endDate: "Jun 2024",
      location: "Remote",
      employmentType: "internship",
      technologies: JSON.stringify(["Python", "Machine Learning", "API-based AI Integration", "Model Deployment"]),
      domains: JSON.stringify(["AI", "Machine Learning"]),
    },
  });
  await prisma.experienceBullet.create({
    data: {
      experienceId: exp4.id,
      content: "Worked on ML models and supported API-based AI integration, gaining exposure across model experimentation and deployment-oriented workflows.",
      isVerified: true,
      sortOrder: 0,
    },
  });

  const exp5 = await prisma.experience.create({
    data: {
      profileId: profile.id,
      company: "Robotics Cell, BIT",
      role: "Club Operations Lead & Technical Team Manager",
      startDate: "Jan 2024",
      endDate: "Jan 2025",
      location: "Bengaluru, India",
      employmentType: "leadership",
      technologies: JSON.stringify(["Physical Robot Development", "Embedded Systems", "Technical Execution"]),
      domains: JSON.stringify(["Robotics", "Leadership"]),
    },
  });
  await prisma.experienceBullet.create({
    data: {
      experienceId: exp5.id,
      content: "Led student robotics initiatives across physical robot development, embedded systems, technical execution, and hackathon delivery; coordinated mechanical, electronics, and software teams.",
      isVerified: true,
      sortOrder: 0,
    },
  });

  // 6. Create Projects & Verified Bullets
  await prisma.projectBullet.deleteMany({ where: { project: { profileId: profile.id } } });
  await prisma.project.deleteMany({ where: { profileId: profile.id } });

  const p1 = await prisma.project.create({
    data: {
      profileId: profile.id,
      projectName: "PARASYTE — Adaptive Robotic Octopod",
      description: "8-legged embodied AI system for autonomous locomotion and navigation featuring hybrid SNN–RNN architecture with self-supervised behavioral adaptation.",
      technologies: JSON.stringify(["Embodied AI", "Robot Learning", "Embedded Robotics", "SNN-RNN", "Surprise Detection", "Continual Learning"]),
      domains: JSON.stringify(["Embodied AI", "Robotics", "Machine Learning"]),
      githubUrl: "https://github.com/ShashwatSahu21",
    },
  });
  await prisma.projectBullet.createMany({
    data: [
      {
        projectId: p1.id,
        content: "Architecting an 8-legged embodied AI system for autonomous locomotion and navigation through predictive sensor-error minimization, without engineered gait tables, reward functions, or simulation pre-training.",
        isVerified: true,
        sortOrder: 0,
      },
      {
        projectId: p1.id,
        content: "Building a hybrid SNN–RNN architecture with adaptive surprise detection, gradient-based credit assignment, prioritized failure replay, and continual-learning mechanisms for self-supervised behavioral adaptation.",
        isVerified: true,
        sortOrder: 1,
      },
      {
        projectId: p1.id,
        content: "Patent application and research paper in preparation.",
        isVerified: true,
        sortOrder: 2,
      },
    ],
  });

  const p2 = await prisma.project.create({
    data: {
      profileId: profile.id,
      projectName: "SynaptIArm-6X — Neural-Augmented Robotic Manipulator",
      description: "6-DOF manipulator translating EMG/EEG-derived biosignals into robotic actions using real-time signal processing and ML-based intent recognition.",
      technologies: JSON.stringify(["Physical AI", "Embedded ML", "EMG/EEG Signal Processing", "Inverse Kinematics", "Servo Control"]),
      domains: JSON.stringify(["Physical AI", "Neural Interfaces", "Robotics"]),
      githubUrl: "https://github.com/ShashwatSahu21/synapticx-6x",
    },
  });
  await prisma.projectBullet.createMany({
    data: [
      {
        projectId: p2.id,
        content: "Developed a 6-DOF manipulator translating EMG/EEG-derived biosignals into robotic actions using real-time signal processing and ML-based intent recognition.",
        isVerified: true,
        sortOrder: 0,
      },
      {
        projectId: p2.id,
        content: "Achieved 94% intent-detection accuracy with <30 ms inference latency; integrated filtering, feature extraction, servo control, and inverse-kinematics-based manipulation.",
        isVerified: true,
        sortOrder: 1,
      },
    ],
  });

  const p3 = await prisma.project.create({
    data: {
      profileId: profile.id,
      projectName: "Custom 12-DOF Quadruped Robot (\"Shashwat's Bot\")",
      description: "Custom 12-DOF quadruped integrating mechanical design, embedded electronics, motor control, Raspberry Pi 4, ESP32, and Python inverse kinematics.",
      technologies: JSON.stringify(["Embedded Robotics", "Motion Control", "Raspberry Pi 4", "ESP32", "IMU Feedback", "Python Inverse Kinematics"]),
      domains: JSON.stringify(["Robotics", "Embedded Robotics", "Motion Control"]),
      githubUrl: "https://github.com/ShashwatSahu21",
    },
  });
  await prisma.projectBullet.create({
    data: {
      projectId: p3.id,
      content: "Designed and built a 12-DOF quadruped integrating mechanical design, embedded electronics, motor control, Raspberry Pi 4, ESP32, IMU-feedback stabilization, and Python-based inverse kinematics.",
      isVerified: true,
      sortOrder: 0,
    },
  });

  // 7. Seed Skills
  await prisma.skill.deleteMany({ where: { profileId: profile.id } });
  const skillsToSeed = [
    { name: "Python", category: "Languages" },
    { name: "C++", category: "Languages" },
    { name: "C", category: "Languages" },
    { name: "JavaScript", category: "Languages" },
    { name: "SQL", category: "Languages" },

    { name: "ROS2", category: "Robotics & Embedded" },
    { name: "Arduino", category: "Robotics & Embedded" },
    { name: "Raspberry Pi", category: "Robotics & Embedded" },
    { name: "ESP32", category: "Robotics & Embedded" },
    { name: "STM32", category: "Robotics & Embedded" },
    { name: "Motor Control", category: "Robotics & Embedded" },
    { name: "Sensor Integration", category: "Robotics & Embedded" },
    { name: "Inverse Kinematics", category: "Robotics & Embedded" },
    { name: "Gazebo", category: "Robotics & Embedded" },
    { name: "PyBullet", category: "Robotics & Embedded" },
    { name: "Fusion 360", category: "Robotics & Embedded" },

    { name: "PyTorch", category: "AI & ML" },
    { name: "TensorFlow", category: "AI & ML" },
    { name: "Scikit-learn", category: "AI & ML" },
    { name: "OpenCV", category: "AI & ML" },
    { name: "YOLO", category: "AI & ML" },
    { name: "CNNs / RNNs", category: "AI & ML" },
    { name: "Signal Processing", category: "AI & ML" },
    { name: "Computer Vision", category: "AI & ML" },
    { name: "Predictive Learning", category: "AI & ML" },
    { name: "Continual Learning", category: "AI & ML" },

    { name: "FastAPI", category: "Software & Product" },
    { name: "REST APIs", category: "Software & Product" },
    { name: "Git / GitHub", category: "Software & Product" },
    { name: "Linux", category: "Software & Product" },
    { name: "RAG / Qdrant", category: "Software & Product" },
    { name: "LLM Integration", category: "Software & Product" },
    { name: "Data Analysis", category: "Software & Product" },
    { name: "Product Development", category: "Software & Product" },
    { name: "Cross-functional Leadership", category: "Software & Product" },
  ];

  await prisma.skill.createMany({
    data: skillsToSeed.map((s) => ({
      profileId: profile.id,
      name: s.name,
      category: s.category,
      evidenceLevel: "verified",
    })),
  });

  console.log("Master Career Database successfully updated with your exact resume!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
