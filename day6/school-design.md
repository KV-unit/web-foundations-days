# School Database Design

## Table Explanations

**`students`**
This table stores the core information about each student. It uses an `INTEGER PRIMARY KEY AUTOINCREMENT` for the `id` to ensure every student has a unique, internal identifier. The `email` column is marked as `TEXT UNIQUE NOT NULL` to ensure that no two students can register with the same email address, which is a critical business rule for this system.

**`courses`**
This table holds the catalog of available courses. Like `students`, it uses an auto-incrementing integer `id` as the primary key. The `title` column is marked `NOT NULL` because a course cannot exist without a name.

**`enrolments`**
This is a **join table** that connects `students` and `courses`. It holds the `student_id` and `course_id` as foreign keys pointing back to their respective tables. It also contains a `grade` column. 

## Relationships

*   **One-to-Many:** A single student can have many enrolments (one-to-many). A single course can have many enrolments (one-to-many).
*   **Many-to-Many:** The relationship between `students` and `courses` is many-to-many. A student can enrol in multiple courses, and a course can have multiple students. 
*   **Why the join table is needed:** Relational databases cannot directly store a many-to-many relationship between two tables. The `enrolments` table acts as the bridge. It breaks the many-to-many relationship into two one-to-many relationships, allowing us to link a specific student to a specific course. Furthermore, it provides a place to store data that belongs *only* to that specific pairing, such as the `grade`.

## Indexing Choice

I would add a single-column index on the `enrolments` table: `CREATE INDEX idx_enrolments_course_id ON enrolments(course_id);`.

**Reason:** While the `UNIQUE (student_id, course_id)` constraint automatically creates a composite index behind the scenes, that index is optimized for lookups starting with `student_id`. It cannot efficiently serve queries that filter or group by `course_id` alone, because `course_id` is not the leading column in the composite index. 

Query 2 ("all students on one course") and Query 3 ("number of students per course") both filter or group by `course_id`. Without a dedicated index on this column, the database would have to perform a full table scan of the `enrolments` table to find all the rows for a specific course. An explicit index on `course_id` provides a distinct performance benefit for these specific reporting queries. 

## SQL vs. NoSQL Decision

For this specific school system, I would strongly choose **SQL** (Relational) over NoSQL. The data here is highly structured and relational by nature. Students, courses, and enrolments have clear, rigid relationships that benefit from ACID (Atomicity, Consistency, Isolation, Durability) compliance—especially regarding grades and enrolments, where data integrity is paramount. The `UNIQUE` constraints and foreign key relationships prevent data anomalies (like a student enrolling in a course twice or an enrolment pointing to a non-existent student). While NoSQL databases are excellent for unstructured data or massive horizontal scaling (like social media feeds), a school system requires strict consistency, complex joins for reporting (like the five queries we wrote), and a well-defined schema, all of which are SQL's strengths.