# Aiqda Education Platform

## Overview
Aiqda is a full-stack MERN (MongoDB, Express.js, React, Node.js) education platform designed for scalability. It features role-based access control, subscription management with manual bank payment approval, video-based lessons with Vimeo integration, quizzes, and comprehensive analytics.

## Tech Stack
- **Backend**: Node.js, Express.js, MongoDB with Mongoose
- **Frontend**: React (Vite), Zustand, Tailwind CSS, Framer Motion
- **Authentication**: JWT-based with role-based access control
- **Video**: Vimeo API integration (admin-only uploads)
- **Styling**: Dark cinematic theme with animations

## Project Structure
```
/backend
  /src
    /modules
      /auth         - Authentication (login, register, JWT)
      /users        - User management
      /subscriptions - Subscription packages and requests
      /payments     - Manual bank payment flow
      /courses      - Course management
      /lessons      - Lesson management with video
      /quizzes      - Quiz system (3 questions per lesson)
      /analytics    - Progress tracking and reporting
      /video        - Vimeo integration
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
1. **Student**: Can browse courses, enroll, watch lessons, take quizzes
2. **Instructor**: Can view analytics for their courses
3. **Admin**: Full access - manage users, courses, payments, subscriptions, Vimeo uploads

## Key Features
- JWT authentication with role-based route protection
- Subscription packages with admin approval workflow
- Manual bank payment submission and approval
- Video-based lessons with watch percentage tracking
- Quiz system with 3 questions per lesson
- Lesson qualification based on watch % + quiz pass
- Student, instructor, and admin dashboards
- Dark cinematic UI with Framer Motion animations

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
- Dark cinematic UI theme applied
