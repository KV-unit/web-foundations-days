-- Day 6: School Database Schema and Queries

-- Create the students table
CREATE TABLE students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL
);

-- Create the courses table
CREATE TABLE courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL
);

-- Create the enrolments table (join table with composite unique constraint)
CREATE TABLE enrolments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    grade TEXT,
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (course_id) REFERENCES courses(id),
    UNIQUE (student_id, course_id)
);

-- Insert sample students
INSERT INTO students (name, email) VALUES 
('Alice Johnson', 'alice@example.com'),
('Bob Smith', 'bob@example.com'),
('Charlie Brown', 'charlie@example.com'),
('Diana Prince', 'diana@example.com');

-- Insert sample courses
INSERT INTO courses (title) VALUES 
('Introduction to SQL'),
('Web Development'),
('Data Structures');

-- Insert sample enrolments (5 enrolments)
-- Note: Diana Prince has no enrolments, which will be used in Query 4.
INSERT INTO enrolments (student_id, course_id, grade) VALUES 
(1, 1, 'A'),
(1, 2, 'B'),
(2, 1, 'C'),
(3, 3, 'A'),
(3, 1, 'B');

-- Query 1: All courses for one student, by name
SELECT courses.title 
FROM courses 
JOIN enrolments ON courses.id = enrolments.course_id 
JOIN students ON enrolments.student_id = students.id 
WHERE students.name = 'Alice Johnson';

-- Query 2: All students on one course
SELECT students.name 
FROM students 
JOIN enrolments ON students.id = enrolments.student_id 
JOIN courses ON enrolments.course_id = courses.id 
WHERE courses.title = 'Introduction to SQL';

-- Query 3: Number of students per course
SELECT courses.title, COUNT(enrolments.student_id) AS student_count 
FROM courses 
JOIN enrolments ON courses.id = enrolments.course_id 
GROUP BY courses.title;

-- Query 4: Students who have no enrolments
SELECT students.name 
FROM students 
LEFT JOIN enrolments ON students.id = enrolments.student_id 
WHERE enrolments.id IS NULL;

-- Query 5: Update one enrolment's grade
UPDATE enrolments 
SET grade = 'A+' 
WHERE id = 2;