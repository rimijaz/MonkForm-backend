# Authentication System Setup Guide

This guide explains how to set up and use the secure authentication system implemented for FutureGenius.

## Features Implemented

### Security Features
- **Password Hashing**: Uses bcryptjs with salt rounds (12) for secure password storage
- **JWT Authentication**: JSON Web Tokens for stateless authentication
- **Role-Based Access Control (RBAC)**: Support for user, admin, and moderator roles
- **Token Expiration**: Configurable token expiration with remember me functionality
- **Input Validation**: Server-side validation for all user inputs
- **Protected Routes**: Middleware to protect sensitive endpoints

### User Management
- User registration with email validation
- Secure login with password comparison
- User profile management
- Account activation/deactivation
- Last login tracking

## Installation Steps

### 1. Install Dependencies

In the server directory, run:
```bash
npm install bcryptjs jsonwebtoken
```

### 2. Environment Configuration

Update your `.env` file with the following variables:
```env
# Database
MONGODB_URI=mongodb+srv://rimijaz88_db_user:qDWbbWI7SPvv5N5W@cluster0.harda6o.mongodb.net/WebForm?appName=Cluster0

# Server
PORT=5000
NODE_ENV=development
```

### 3. Database Setup

Ensure MongoDB is running and accessible at the configured URI.

### 4. Start the Server

```bash
# Development
npm run dev

```

## API Endpoints

### Authentication Routes (`/api/auth/`)

#### POST `/api/auth/register`
Register a new user account.

**Request Body:**
```json
{
  "_id": "69a67b1c9e153ddd460827a5",
  "firstName": "Test",
  "lastName": "Builder",
  "email": "test@gmail.com",
  "password": "$2b$12$/.DoYRHAHniuFU7kq4eD/.9qj5ig/gLjqDYTACZq",
  "role": "user",
  "createdAt": {
    "$date": "2026-03-03T06:09:32.463Z"
  },
  "updatedAt": {
    "$date": "2026-03-03T06:09:32.463Z"
  }
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "_id": "user_id",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "role": "user",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "token": "jwt_token_here"
}
```

#### POST `/api/auth/login`
Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "email": "test@gmail.com",
  "password": "$2b$12$/.DoYRHAHniuFU7kq4pUOnwZhg/gLjqDYTACZq",
}
```

**Response:**
```json
{
  "message": "Login successful",
  "user": {
    "_id": "user_id",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "role": "user",
    "lastLogin": "2024-01-01T12:00:00.000Z",
  },
  "token": "jwt_token_here",
  "expiresIn": "7d"
}
```

## Frontend Integration

### Authentication Flow

1. **Login/Registration**: User submits form to `/api/auth/login` or `/api/auth/register`
2. **Token Storage**: Store received JWT token and user data in localStorage
3. **Protected Routes**: Use `ProtectedRoute` component to protect sensitive pages
4. **Token Validation**: Automatic token validation on protected routes
5. **Logout**: Clear localStorage and redirect to auth page
