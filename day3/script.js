let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];

// searchNotes(word) returns an array of notes whose text contains word, ignoring upper and lower case.
function searchNotes(word) {
  return notes.filter(note => note.text.toLowerCase().includes(word.toLowerCase()));
}

// longestNote() returns the note object with the most characters, or null if there are no notes.
function longestNote() {
  if (notes.length === 0) {
    return null;
  }
  let longest = notes[0];
  for (let i = 1; i < notes.length; i++) {
    if (notes[i].text.length > longest.text.length) {
      longest = notes[i];
    }
  }
  return longest;
}

// countByCategory() returns an object counting notes per category.
function countByCategory() {
  let counts = {};
  for (let i = 0; i < notes.length; i++) {
    let cat = notes[i].category;
    counts[cat] = (counts[cat] || 0) + 1;
  }
  return counts;
}

// getSummary() returns a sentence such as "5 notes: 2 personal, 1 work, 2 study."
function getSummary() {
  const counts = countByCategory();
  const total = notes.length;
  return `${total} notes: ${counts.personal || 0} personal, ${counts.work || 0} work, ${counts.study || 0} study.`;
}

// isDuplicate(text) returns true if a note with the same text already exists (ignoring case and extra spaces).
function isDuplicate(text) {
  const normalizedText = text.trim().toLowerCase();
  return notes.some(note => note.text.trim().toLowerCase() === normalizedText);
}

// addNote(text, category) adds a note only if valid, returns true if added, false otherwise.
function addNote(text, category) {
  // 1. Check length
  if (text.length < 1 || text.length > 200) {
    console.log("Error: Note must be between 1 and 200 characters.");
    return false;
  }

  // 2. Check for duplicates
  if (isDuplicate(text)) {
    console.log("Error: This note already exists.");
    return false;
  }

  // 3. Check category
  if (!["personal", "work", "study"].includes(category)) {
    console.log("Error: Category must be 'personal', 'work', or 'study'.");
    return false;
  }

  // 4. Add note
  notes.push({
    id: notes.length + 1,
    text: text,
    category: category
  });
  return true;
}

// ==========================================
// TESTS
// ==========================================

console.log("--- Testing searchNotes ---");
console.log(searchNotes("milk")); // expect: the "Buy milk and bread" note
console.log(searchNotes("zzz"));  // expect: []

console.log("\n--- Testing longestNote ---");
console.log(longestNote());       // expect: the longest text note
// Real edge case: temporarily empty the array to test the null return
let originalNotes = notes;
notes = [];
console.log(longestNote());       // expect: null
notes = originalNotes;            // restore the original array for subsequent tests

console.log("\n--- Testing countByCategory ---");
console.log(countByCategory());   // expect: { personal: 2, work: 1, study: 2 }

console.log("\n--- Testing countByCategory (edge case) ---");
let saved = notes;
notes = [];
console.log(countByCategory()); // expect: {}
notes = saved;

console.log("\n--- Testing getSummary ---");
console.log(getSummary());        // expect: "5 notes: 2 personal, 1 work, 2 study."

console.log("\n--- Testing getSummary (edge case) ---");
notes = [];
console.log(getSummary()); // expect: "0 notes: 0 personal, 0 work, 0 study."
notes = saved;

console.log("\n--- Testing isDuplicate ---");
console.log(isDuplicate("buy milk and bread")); // expect: true
console.log(isDuplicate("something new"));      // expect: false

console.log("\n--- Testing addNote ---");
console.log(addNote("Pay rent", "work"));       // expect: true
console.log(addNote("", "work"));               // expect: false (invalid length)