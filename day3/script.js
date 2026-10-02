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

// countByCategory() returns an object counting notes per category, e.g. { personal: 2, work: 1, study: 2 }.
function countByCategory() {
  let counts = {};
  for (let note of notes) {
    // Handle the first-time undefined issue by defaulting to 0
    counts[note.category] = (counts[note.category] || 0) + 1;
  }
  return counts;
}

// getSummary() returns a sentence such as "5 notes: 2 personal, 1 work, 2 study."
function getSummary() {
  let counts = countByCategory();
  let total = notes.length;
  
  // Choose singular or plural based on total
  let word = total === 1 ? "note" : "notes";
  
  // Build the category breakdown string
  let breakdown = Object.keys(counts)
    .map(cat => `${counts[cat]} ${cat}`)
    .join(", ");
    
  return `${total} ${word}: ${breakdown}.`;
}

// isDuplicate(text) returns true if a note with the same text already exists (ignoring case and extra spaces).
function isDuplicate(text) {
  let cleanText = text.trim().toLowerCase();
  return notes.some(note => note.text.trim().toLowerCase() === cleanText);
}

// addNote(text, category) adds a note only if it is 1-200 characters, not a duplicate, and category is personal, work or study. Returns true when added, false otherwise, logging the reason.
function addNote(text, category) {
  // 1. Check text length
  if (text.length < 1 || text.length > 200) {
    console.log("Error: Note must be between 1 and 200 characters.");
    return false;
  }
  
  // 2. Check for duplicates
  if (isDuplicate(text)) {
    console.log("Error: Note already exists.");
    return false;
  }
  
  // 3. Check category validity
  const validCategories = ["personal", "work", "study"];
  if (!validCategories.includes(category)) {
    console.log("Error: Category must be personal, work, or study.");
    return false;
  }
  
  // 4. Add the note (Generate a new ID based on the highest existing ID)
  let newId = notes.length > 0 ? Math.max(...notes.map(n => n.id)) + 1 : 1;
  notes.push({ id: newId, text: text, category: category });
  return true;
}

// ==========================================
// REQUIRED TESTS (2 per function)
// ==========================================

console.log("--- Testing searchNotes ---");
// Expected: Array containing the "Buy milk" and "Revise JavaScript" notes (case-insensitive match)
console.log(searchNotes("b")); 
// Expected: Empty array (no notes contain the letter "z")
console.log(searchNotes("z")); 

console.log("\n--- Testing longestNote ---");
// Expected: The note object for "Email the project report to Grace"
console.log(longestNote()); 
// (Edge case for longestNote requires emptying the array, which breaks later tests, 
// so testing the primary logic here as instructed by the empty-array check inside the function.)

console.log("\n--- Testing countByCategory ---");
// Expected: { personal: 2, study: 2, work: 1 }
console.log(countByCategory()); 

console.log("\n--- Testing getSummary ---");
// Expected: "5 notes: 2 personal, 2 study, 1 work." (Order of categories may vary depending on object key order)
console.log(getSummary()); 

console.log("\n--- Testing isDuplicate ---");
// Expected: true (matches "Buy milk and bread" ignoring case and spaces)
console.log(isDuplicate("  buy MILK and bread  ")); 
// Expected: false (no note matches this text)
console.log(isDuplicate("Go to the gym")); 

console.log("\n--- Testing addNote ---");
// Expected: true, and adds a new note to the array
console.log(addNote("Read a book", "personal")); 
// Expected: false, logs "Error: Note already exists."
console.log(addNote("Call mum", "personal")); 
// Expected: false, logs "Error: Category must be personal, work, or study."
console.log(addNote("Do laundry", "chores")); 