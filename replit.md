# Aiqda Skill-Based Platform

## Overview
Aiqda is a full-stack MERN (MongoDB, Express.js, React, Node.js) skill-based platform designed for scalability. It features role-based access control, subscription management with manual bank payment approval, video-based contents with Vimeo integration, quizzes, and comprehensive analytics.

## Terminology
The platform uses the following display terminology (backend routes/DB fields use original names):
- **Chapter** (DB: course) - A collection of related contents
- **Content** (DB: lesson) - An individual learning unit with video, documents, and quiz
- **Creator** (DB: instructor) - A user who creates and manages chapters
- **Member** (DB: student) - A user who enrolls in chapters and learns
- **Achievement** (DB: certificate) - Accomplishments earned by members

## Tech Stack
- **Backend**: Node.js, Express.js, MongoDB with Mongoose
- **Frontend**: React (Vite), Zustand, Tailwind CSS, Framer Motion
- **Authentication**: JWT-based with role-based access control
- **Video**: Vimeo API integration (admin-only uploads)
- **Styling**: Clean light theme with brand colors, Framer Motion animations

## Project Structure
```
/backend
  /src
    /modules
      /auth         - Authentication (login, register, JWT)
      /users        - User management
      /subscriptions - Subscription packages and requests
      /payments     - Manual bank payment flow
      /courses      - Chapter management (DB name: courses)
      /lessons      - Content management with video (DB name: lessons)
      /quizzes      - Quiz system (1-8 questions per content)
      /analytics    - Progress tracking and reporting
      /video        - Vimeo integration
      /instructor-applications - Creator application & approval workflow
      /studio-applications - Studio (Animation/VFX) application & approval workflow
    /middlewares    - Auth, upload middleware
    /utils          - JWT, password hashing
    app.js
    server.js

/frontend
  /src
    /components     - Reusable UI components
    /pages          - All application pages
    /layouts        - Layout components
    /services       - API service layer
    /store          - Zustand stores
    /styles         - Global styles
    main.jsx
    App.jsx
```

## User Roles
1. **Member** (role: student): Can browse chapters, enroll, watch contents, take quizzes
2. **Creator** (role: instructor): Can create/manage chapters, contents, upload files, create quizzes (1-8 questions, 3 options each); ownership-checked
3. **Admin**: Full access - manage users, chapters, payments, subscriptions, Vimeo video assignment to contents

## Key Features
- JWT authentication with role-based route protection
- Subscription packages with admin approval workflow
- Manual bank payment submission and approval
- Video-based contents with watch percentage tracking
- Quiz system with 1-8 questions per content (3 options each)
- Content qualification based on watch % + quiz pass
- Member, creator, and admin dashboards
- Creator application system with multi-step form and admin review
- Clean light UI with Framer Motion animations

## Running the Application
- Backend runs on port 3001
- Frontend runs on port 5000
- MongoDB runs locally on port 27017

## Environment Variables
Backend (.env):
- PORT=3001
- MONGODB_URI=mongodb://localhost:27017/aiqda
- JWT_SECRET=your-secret-key
- VIMEO_ACCESS_TOKEN=your-vimeo-token (optional)

## Recent Changes
- Initial MVP implementation with all core modules
- Role-based access control implemented
- Manual payment approval flow completed
- Quiz system with progress tracking
- **Light theme overhaul**: Clean light theme with white backgrounds, soft shadows, pastel accent orbs, brand-matching color palette
- **Creator Application System**: Multi-step form (/apply-instructor) with 5 steps, file uploads, admin review page with approve/reject workflow
- **Subscription packages**: Fields include name, price, scheduleDuration, durationDays, learningMode, focus, courses (references), softwareExposure, outcome
- **Dashboard navigation**: Persistent sidebar (DashboardSidebar) and mobile nav for all dashboard areas with role-based links
- **Admin seed script**: backend/src/seed.js creates default admin (admin@aiqda.com / admin123)
- **Creator chapter management**: Full CRUD for chapters/contents/quizzes with ownership checks
- **Quiz system**: 1-8 questions per quiz, 3 options each, dynamic passing score
- **Content file uploads**: Creators upload supporting files via multer
- **Admin Vimeo assignment**: AdminCourses page with Vimeo Video ID assignment per content
- **Shared animation system**: Reusable Framer Motion variants in animations.js
- **Auto-seed on empty database**: server.js seeds demo data if no users exist
- **Vimeo Integration (Full)**: Real Vimeo API with Bearer token auth, video validation, `@vimeo/player` SDK with real-time tracking
- **Terminology rebrand**: All frontend display text updated — Course→Chapter, Lesson→Content, Instructor→Creator, Student→Member. Backend routes/DB fields unchanged.
- **Consultation Booking System**: Public listing at /consultations, detail+booking at /consultations/:id. 4 types seeded (Creative Audit 250 SAR/30 min, Project Review 450 SAR/60 min, Studio Advisory 700 SAR/90 min, Strategic Collaboration contract/1 hr). Bank Albilad payment flow — user transfers money, submits payment reference, admin confirms → Zoom scheduler link activated. Admin CRUD at /admin/consultations (add/edit/delete types), admin booking review at /admin/consultation-bookings (approve/reject). User booking history at /dashboard/consultations. Consultations link in Navbar and admin/student sidebars. `consultationsAPI` + `consultationBookingsAPI` added to api.js. DB auto-seeds consultations independently from users via `seedConsultationsIfEmpty()`.
- **About Us page** (`/about`): Public page with four sections — hero ("One Center, All Things Animation"), vision/message quote, team profiles (Abdulwahed Alabdlee & Michael Murengezi with achievements), and contact section. "About" link added to Navbar for all visitors. `slideInRight` animation variant added to animations.js.
- **Studio Application System**: 4-step application form at /apply-studio for Animation & VFX studios (Section 1: Identity, Section 2: Delivery Format policy acknowledgments, Section 3: Contribution domains, Section 4: Objectives). Admin review page at /admin/studio-applications with approve/reject workflow. "For Studios" section added to home page. API: POST/GET /api/studio-applications, PATCH /:id/approve|reject. Wired into admin sidebar (🎬 Studio Apps), admin dashboard quick actions, and api.js studioApplicationsAPI.
