// --- 1. Select the six elements by ID ---
const noteText = document.getElementById('note-text');
const charCount = document.getElementById('char-count');
const wordCount = document.getElementById('word-count');
const clearBtn = document.getElementById('clear-btn');
const themeToggle = document.getElementById('theme-toggle');
const body = document.body;

// --- 2. Define the updateCounts function ---
function updateCounts() {
    // Get the raw text
    const text = noteText.value;
    
    // Calculate characters
    const charTotal = text.length;
    
    // Calculate words (splitting by spaces and filtering out empty strings)
    const wordTotal = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    
    // Update the text content of the paragraphs
    charCount.textContent = `${charTotal} / 200 characters`;
    wordCount.textContent = `${wordTotal} words`;
    
    // Toggle warning and over classes based on character count
    charCount.classList.toggle("warning", charTotal > 180);
    charCount.classList.toggle("over", charTotal > 200);
}

// --- 3. Textarea Event Listener (Typing and Saving Draft) ---
noteText.addEventListener('input', () => {
    updateCounts();
    // Save current text as a draft
    localStorage.setItem("draft", noteText.value);
});

// --- 4. Clear Note Function (Used for both Button and Escape key) ---
function clearNote() {
    noteText.value = "";          // Empty the textarea
    updateCounts();               // Reset the counters
    localStorage.removeItem("draft"); // Remove the saved draft
}

// Clear button click listener
clearBtn.addEventListener('click', clearNote);

// Escape key listener on the textarea
noteText.addEventListener('keydown', (event) => {
    if (event.key === "Escape") {
        clearNote();
    }
});

// --- 5. Theme Button Click Listener ---
themeToggle.addEventListener('click', () => {
    // Toggle the dark class on the body
    body.classList.toggle("dark");
    
    // Check if dark mode is now active
    const isDark = body.classList.contains("dark");
    
    // Update the button label
    themeToggle.textContent = isDark ? "Light mode" : "Dark mode";
    
    // Save the theme choice to localStorage
    localStorage.setItem("theme", isDark ? "dark" : "light");
});

// --- 6. On Page Load (Restoring State) ---
// Note: This runs top-level, exactly as requested
const savedDraft = localStorage.getItem("draft");
if (savedDraft) {
    noteText.value = savedDraft;
}

const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") {
    body.classList.add("dark");
    themeToggle.textContent = "Light mode";
} else {
    // Ensure button says "Dark mode" if theme is light or not set
    themeToggle.textContent = "Dark mode";
}

// Run updateCounts once on load so counters reflect the restored draft
updateCounts();