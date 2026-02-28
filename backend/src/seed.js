import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './modules/users/user.model.js';
import Course from './modules/courses/course.model.js';
import Lesson from './modules/lessons/lesson.model.js';
import Quiz from './modules/quizzes/quiz.model.js';
import { LessonProgress, CourseProgress } from './modules/analytics/progress.model.js';
import { SubscriptionPackage, Subscription } from './modules/subscriptions/subscription.model.js';
import Payment from './modules/payments/payment.model.js';
import { hashPassword } from './utils/password.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aiqda';

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(monthsAgo) {
  const now = new Date();
  const past = new Date(now.getTime() - monthsAgo * 30 * 24 * 60 * 60 * 1000);
  return new Date(past.getTime() + Math.random() * (now.getTime() - past.getTime()));
}

export async function seedDatabase(options = {}) {
  const isStandalone = options.standalone !== false;
  if (isStandalone) {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
  }

  await User.deleteMany({});
  await Course.deleteMany({});
  await Lesson.deleteMany({});
  await Quiz.deleteMany({});
  await LessonProgress.deleteMany({});
  await CourseProgress.deleteMany({});
  await SubscriptionPackage.deleteMany({});
  await Subscription.deleteMany({});
  await Payment.deleteMany({});
  console.log('Cleared existing data');

  const hashedPassword = await hashPassword('admin123');
  const admin = await User.create({
    email: 'admin@aiqda.com',
    password: hashedPassword,
    name: 'Admin User',
    role: 'admin',
  });
  console.log('Admin created: admin@aiqda.com / admin123');

  const instructorPassword = await hashPassword('instructor123');
  const instructorsData = [
    { name: 'Sarah Al-Rashidi', email: 'sarah@aiqda.com' },
    { name: 'Mohammed Al-Harbi', email: 'mohammed@aiqda.com' },
    { name: 'Fatima Al-Zahrani', email: 'fatima@aiqda.com' },
  ];
  const instructors = [];
  for (const data of instructorsData) {
    const instructor = await User.create({
      ...data,
      password: instructorPassword,
      role: 'instructor',
    });
    instructors.push(instructor);
  }
  console.log('3 instructors created (password: instructor123)');

  const studentPassword = await hashPassword('student123');
  const studentNames = [
    'Ahmad Khan', 'Layla Nassar', 'Omar Farouk', 'Noor Al-Din', 'Yusuf Bakri',
    'Hana Saleh', 'Khalid Mansour', 'Reem Othman', 'Tariq Hamdan', 'Maryam Jaber',
    'Ali Hussein', 'Dina Khoury', 'Sami Rizk', 'Jana Masri', 'Faisal Qasim',
  ];
  const students = [];
  for (let i = 0; i < studentNames.length; i++) {
    const student = await User.create({
      name: studentNames[i],
      email: `student${i + 1}@aiqda.com`,
      password: studentPassword,
      role: 'student',
    });
    students.push(student);
  }
  console.log('15 students created (password: student123)');

  const coursesConfig = [
    {
      instructor: instructors[0],
      courses: [
        {
          title: 'AutoCAD Fundamentals',
          description: 'Master the basics of AutoCAD for architectural and engineering drafting. Learn 2D drawing, dimensioning, layers, and plotting.',
          category: 'Engineering',
          level: 'beginner',
          isPublished: true,
          lessons: [
            { title: 'Introduction to AutoCAD Interface', description: 'Navigate the AutoCAD workspace, toolbars, and command line' },
            { title: 'Basic Drawing Commands', description: 'Lines, circles, arcs, rectangles, and polygons' },
            { title: 'Editing and Modifying Objects', description: 'Move, copy, rotate, mirror, trim, and extend commands' },
            { title: 'Working with Layers', description: 'Creating layers, assigning colors, linetypes, and managing visibility' },
            { title: 'Dimensioning and Annotations', description: 'Adding dimensions, text, and annotations to drawings' },
          ],
        },
        {
          title: 'Advanced AutoCAD 3D Modeling',
          description: 'Take your AutoCAD skills to the next level with 3D modeling, rendering, and visualization techniques.',
          category: 'Engineering',
          level: 'advanced',
          isPublished: true,
          lessons: [
            { title: '3D Coordinate Systems', description: 'Understanding UCS, WCS, and 3D navigation' },
            { title: 'Solid Modeling Basics', description: 'Creating 3D solids: box, cylinder, sphere, extrude, revolve' },
            { title: 'Boolean Operations', description: 'Union, subtract, and intersect operations' },
            { title: 'Rendering and Materials', description: 'Applying materials, lighting, and creating renders' },
          ],
        },
      ],
    },
    {
      instructor: instructors[1],
      courses: [
        {
          title: 'Revit Architecture Essentials',
          description: 'Learn Building Information Modeling (BIM) with Autodesk Revit. Create architectural plans, sections, and 3D views.',
          category: 'Architecture',
          level: 'beginner',
          isPublished: true,
          lessons: [
            { title: 'Revit Interface and Project Setup', description: 'Setting up a new project, templates, and navigation' },
            { title: 'Creating Walls and Doors', description: 'Placing structural and architectural walls, doors, and windows' },
            { title: 'Floor Plans and Levels', description: 'Working with levels, floor plans, and ceiling plans' },
            { title: 'Roofs and Stairs', description: 'Creating roof systems and staircase designs' },
            { title: 'Schedules and Sheets', description: 'Generating material schedules and preparing sheet layouts' },
            { title: 'Rendering in Revit', description: 'Creating photorealistic renderings and walkthroughs' },
          ],
        },
        {
          title: 'SketchUp for Interior Design',
          description: 'Use SketchUp to create stunning interior design presentations with 3D models, materials, and lighting.',
          category: 'Interior Design',
          level: 'intermediate',
          isPublished: true,
          lessons: [
            { title: 'SketchUp Workspace Setup', description: 'Interface overview, plugins, and workspace customization' },
            { title: 'Modeling Furniture and Fixtures', description: 'Creating and importing 3D furniture models' },
            { title: 'Materials and Textures', description: 'Applying realistic materials, textures, and custom finishes' },
          ],
        },
      ],
    },
    {
      instructor: instructors[2],
      courses: [
        {
          title: 'Excel for Business Analytics',
          description: 'Master Excel formulas, pivot tables, charts, and data analysis for business decision-making.',
          category: 'Business',
          level: 'intermediate',
          isPublished: true,
          lessons: [
            { title: 'Advanced Formulas and Functions', description: 'VLOOKUP, INDEX-MATCH, SUMIFS, and array formulas' },
            { title: 'Pivot Tables Mastery', description: 'Creating and customizing pivot tables and pivot charts' },
            { title: 'Data Visualization with Charts', description: 'Building dashboards with dynamic charts and sparklines' },
            { title: 'Power Query Introduction', description: 'Importing, transforming, and cleaning data with Power Query' },
          ],
        },
        {
          title: 'Project Management with Primavera P6',
          description: 'Learn project scheduling, resource management, and cost tracking with Oracle Primavera P6.',
          category: 'Project Management',
          level: 'advanced',
          isPublished: true,
          lessons: [
            { title: 'P6 Interface and Project Creation', description: 'Navigating P6, creating EPS, OBS, and projects' },
            { title: 'Activity Planning and WBS', description: 'Defining WBS, activities, and durations' },
            { title: 'Scheduling and Critical Path', description: 'Scheduling, relationships, constraints, and CPM analysis' },
            { title: 'Resource Assignment and Leveling', description: 'Assigning resources, analyzing histograms, and leveling' },
            { title: 'Baselines and Progress Tracking', description: 'Setting baselines, updating progress, and earned value' },
          ],
        },
        {
          title: 'Introduction to Python Programming',
          description: 'Start your programming journey with Python. Learn variables, loops, functions, and basic data structures.',
          category: 'Programming',
          level: 'beginner',
          isPublished: false,
          lessons: [
            { title: 'Python Setup and First Program', description: 'Installing Python, IDE setup, and Hello World' },
            { title: 'Variables and Data Types', description: 'Strings, integers, floats, lists, and dictionaries' },
            { title: 'Control Flow', description: 'If/else statements, for loops, while loops' },
          ],
        },
      ],
    },
  ];

  const quizBank = [
    [
      { question: 'What is the default file extension for AutoCAD drawings?', options: ['.dwg', '.dxf', '.pdf'], correctAnswer: 0 },
      { question: 'Which command draws a straight line between two points?', options: ['LINE', 'CIRCLE', 'ARC'], correctAnswer: 0 },
      { question: 'What does the TRIM command do?', options: ['Cuts objects at a boundary', 'Extends objects', 'Deletes objects'], correctAnswer: 0 },
    ],
    [
      { question: 'What does BIM stand for?', options: ['Building Information Modeling', 'Basic Interior Management', 'Blueprint Integration Method'], correctAnswer: 0 },
      { question: 'Which view shows a horizontal cut through a building?', options: ['Floor Plan', 'Section', 'Elevation'], correctAnswer: 0 },
    ],
    [
      { question: 'What function finds the first match in a column?', options: ['VLOOKUP', 'SUM', 'COUNT'], correctAnswer: 0 },
      { question: 'Pivot tables are used for:', options: ['Summarizing large datasets', 'Writing macros', 'Creating forms'], correctAnswer: 0 },
      { question: 'Which chart type shows trends over time?', options: ['Line chart', 'Pie chart', 'Doughnut chart'], correctAnswer: 0 },
      { question: 'What is Power Query used for?', options: ['Data transformation', 'Creating slides', 'Writing emails'], correctAnswer: 0 },
    ],
    [
      { question: 'What is WBS in project management?', options: ['Work Breakdown Structure', 'Work Budget System', 'Workflow Base Setup'], correctAnswer: 0 },
      { question: 'CPM stands for:', options: ['Critical Path Method', 'Cost Planning Model', 'Central Project Manager'], correctAnswer: 0 },
      { question: 'What is earned value analysis?', options: ['A method to measure project performance', 'A billing technique', 'A scheduling algorithm'], correctAnswer: 0 },
    ],
    [
      { question: 'Which tool applies materials to 3D faces in SketchUp?', options: ['Paint Bucket', 'Push/Pull', 'Follow Me'], correctAnswer: 0 },
      { question: 'What is the SketchUp file extension?', options: ['.skp', '.skm', '.sku'], correctAnswer: 0 },
    ],
  ];

  const allCourses = [];
  const allLessons = [];

  for (const group of coursesConfig) {
    for (const courseData of group.courses) {
      const course = await Course.create({
        title: courseData.title,
        description: courseData.description,
        category: courseData.category,
        level: courseData.level,
        isPublished: courseData.isPublished,
        instructor: group.instructor._id,
        lessonsCount: courseData.lessons.length,
      });

      const courseLessons = [];
      for (let i = 0; i < courseData.lessons.length; i++) {
        const lessonData = courseData.lessons[i];
        const lesson = await Lesson.create({
          title: lessonData.title,
          description: lessonData.description,
          course: course._id,
          order: i + 1,
          vimeoVideoId: courseData.isPublished && Math.random() > 0.25 ? `${randomBetween(100000000, 999999999)}` : null,
          supportingFile: `/uploads/lessons/demo-${Date.now()}-${i}.pdf`,
          supportingFileName: `${lessonData.title.replace(/\s+/g, '_')}.pdf`,
          duration: randomBetween(600, 3600),
        });
        courseLessons.push(lesson);
        allLessons.push(lesson);

        const quizQuestions = quizBank[randomBetween(0, quizBank.length - 1)];
        const numQuestions = Math.min(quizQuestions.length, randomBetween(2, 4));
        await Quiz.create({
          lesson: lesson._id,
          questions: quizQuestions.slice(0, numQuestions),
          passingScore: Math.ceil(numQuestions * 0.6),
        });
      }

      if (courseData.isPublished) {
        const numEnrolled = randomBetween(4, 12);
        const enrolledStudentIds = [];
        const shuffled = [...students].sort(() => Math.random() - 0.5);
        for (let s = 0; s < Math.min(numEnrolled, shuffled.length); s++) {
          enrolledStudentIds.push(shuffled[s]._id);
        }
        course.enrolledStudents = enrolledStudentIds;
        await course.save();

        for (const studentId of enrolledStudentIds) {
          let completedCount = 0;
          for (const lesson of courseLessons) {
            const watchPct = randomBetween(30, 100);
            const quizPassed = watchPct >= 80 && Math.random() > 0.3;
            const isQualified = watchPct >= 80 && quizPassed;
            if (isQualified) completedCount++;

            const progressDate = randomDate(6);
            await LessonProgress.create({
              user: studentId,
              lesson: lesson._id,
              course: course._id,
              watchPercentage: watchPct,
              quizPassed,
              quizScore: quizPassed ? randomBetween(2, 4) : randomBetween(0, 1),
              quizAttempts: randomBetween(1, 3),
              isQualified,
              lastWatchedAt: progressDate,
              completedAt: isQualified ? progressDate : null,
            });
          }

          const progressPct = Math.round((completedCount / courseLessons.length) * 100);
          const startDate = randomDate(8);
          await CourseProgress.create({
            user: studentId,
            course: course._id,
            completedLessons: completedCount,
            totalLessons: courseLessons.length,
            progressPercentage: progressPct,
            isCompleted: progressPct === 100,
            startedAt: startDate,
            completedAt: progressPct === 100 ? randomDate(3) : null,
          });
        }
      }

      allCourses.push(course);
    }
  }
  console.log(`${allCourses.length} courses created with ${allLessons.length} lessons, quizzes, and progress data`);

  const packages = [
    {
      name: 'Engineering Starter',
      price: 499,
      scheduleDuration: '4 weeks',
      durationDays: 30,
      learningMode: 'Self-paced',
      focus: 'CAD Fundamentals',
      courses: allCourses.filter(c => c.category === 'Engineering').map(c => c._id),
      softwareExposure: ['AutoCAD'],
      outcome: 'Master 2D and 3D CAD drafting fundamentals',
    },
    {
      name: 'Architecture Professional',
      price: 799,
      scheduleDuration: '8 weeks',
      durationDays: 60,
      learningMode: 'Instructor-led',
      focus: 'BIM & Design',
      courses: allCourses.filter(c => ['Architecture', 'Interior Design'].includes(c.category)).map(c => c._id),
      softwareExposure: ['Revit', 'SketchUp'],
      outcome: 'Create professional architectural designs using BIM tools',
    },
    {
      name: 'Business Analytics Bundle',
      price: 599,
      scheduleDuration: '6 weeks',
      durationDays: 45,
      learningMode: 'Hybrid',
      focus: 'Data Analysis & PM',
      courses: allCourses.filter(c => ['Business', 'Project Management'].includes(c.category)).map(c => c._id),
      softwareExposure: ['Excel', 'Primavera P6'],
      outcome: 'Analyze business data and manage projects effectively',
    },
    {
      name: 'Complete Professional Package',
      price: 1499,
      scheduleDuration: '12 weeks',
      durationDays: 90,
      learningMode: 'Instructor-led',
      focus: 'Full Curriculum',
      courses: allCourses.filter(c => c.isPublished).map(c => c._id),
      softwareExposure: ['AutoCAD', 'Revit', 'SketchUp', 'Excel', 'Primavera P6'],
      outcome: 'Complete engineering and business professional certification',
    },
  ];

  const createdPackages = [];
  for (const pkg of packages) {
    const p = await SubscriptionPackage.create(pkg);
    createdPackages.push(p);
  }
  console.log(`${createdPackages.length} subscription packages created`);

  const subscribedStudents = students.slice(0, 10);
  for (const student of subscribedStudents) {
    const pkg = createdPackages[randomBetween(0, createdPackages.length - 1)];
    const startDate = randomDate(4);
    const endDate = new Date(startDate.getTime() + pkg.durationDays * 24 * 60 * 60 * 1000);

    const sub = await Subscription.create({
      user: student._id,
      package: pkg._id,
      status: 'active',
      startDate,
      endDate,
      approvedBy: admin._id,
      approvedAt: startDate,
    });

    await Payment.create({
      user: student._id,
      subscription: sub._id,
      amount: pkg.price,
      paymentReference: `ALB-${Date.now()}-${randomBetween(1000, 9999)}`,
      status: 'approved',
      reviewedBy: admin._id,
      reviewedAt: startDate,
      bankName: 'Bank Albilad',
    });
  }
  console.log('10 active subscriptions with approved payments created');

  for (let i = 0; i < 3; i++) {
    const student = students[10 + i];
    const pkg = createdPackages[randomBetween(0, 2)];

    const sub = await Subscription.create({
      user: student._id,
      package: pkg._id,
      status: 'pending',
    });

    await Payment.create({
      user: student._id,
      subscription: sub._id,
      amount: pkg.price,
      paymentReference: `ALB-PENDING-${randomBetween(10000, 99999)}`,
      status: 'submitted',
      bankName: 'Bank Albilad',
    });
  }
  console.log('3 pending payment requests created');

  console.log('\n=== Demo Data Summary ===');
  console.log('Admin: admin@aiqda.com / admin123');
  console.log('Instructors (password: instructor123):');
  instructors.forEach(i => console.log(`  - ${i.name}: ${i.email}`));
  console.log('Students (password: student123):');
  console.log(`  - student1@aiqda.com through student15@aiqda.com`);
  console.log(`Courses: ${allCourses.length} (${allCourses.filter(c => c.isPublished).length} published)`);
  console.log(`Lessons: ${allLessons.length} with quizzes`);
  console.log(`Subscription Packages: ${createdPackages.length}`);
  console.log('========================\n');

  if (isStandalone) {
    await mongoose.disconnect();
  }
  console.log('Done!');
}

export async function autoSeedIfEmpty() {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('Database is empty — auto-seeding demo data...');
      await seedDatabase({ standalone: false });
    }
  } catch (error) {
    console.error('Auto-seed check failed:', error.message);
  }
}

const isDirectRun = process.argv[1]?.includes('seed.js');
if (isDirectRun) {
  seedDatabase({ standalone: true }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
