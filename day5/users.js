// --- 1. Select the four elements by ID ---
const loadUsersBtn = document.getElementById('load-users');
const filterInput = document.getElementById('filter-input');
const statusEl = document.getElementById('status');
const usersList = document.getElementById('users-list');

// --- 2. Keep a variable outside any function to hold the loaded data ---
let users = [];

// --- 3. Write renderUsers(list) ---
function renderUsers(list) {
    // Clear the list first
    usersList.innerHTML = '';

    // Handle empty list state (either from search or no data)
    if (list.length === 0) {
        const li = document.createElement('li');
        li.textContent = "No users match your filter.";
        usersList.appendChild(li);
        return;
    }

    // Loop over the list and create <li> elements
    list.forEach(user => {
        const li = document.createElement('li');
        
        // Use textContent (never innerHTML) to prevent XSS
        // Using the nested API paths as specified: user.address.city and user.company.name
        li.textContent = `${user.name} — ${user.address.city} — ${user.company.name}`;
        
        usersList.appendChild(li);
    });
}

// --- 4. Write async function loadUsers() ---
async function loadUsers() {
    // Before try: disable button and set status to loading
    loadUsersBtn.disabled = true;
    statusEl.textContent = "Loading...";

    try {
        // Inside try: await fetch, check response.ok
        const response = await fetch('https://jsonplaceholder.typicode.com/users');
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        // Parse the JSON body
        const data = await response.json();
        
        // Store it in users
        users = data;
        
        // Call renderUsers with the full list
        renderUsers(users);
        
        // Set status to a success message
        statusEl.textContent = `Successfully loaded ${users.length} users.`;

    } catch (error) {
        // Inside catch: set status to an error message
        // Using error.message makes the actual fetch failure visible
        statusEl.textContent = `Error: ${error.message}`;
        
    } finally {
        // Inside finally: re-enable the button
        // This runs whether it succeeded or failed
        loadUsersBtn.disabled = false;
    }
}

// --- 5. Add a click listener on the Load Users button ---
loadUsersBtn.addEventListener('click', loadUsers);

// --- 6. Add an input listener on the filter box ---
filterInput.addEventListener('input', (event) => {
    const searchTerm = event.target.value.toLowerCase();
    
    // Filter the stored users array by name
    const filteredUsers = users.filter(user => 
        user.name.toLowerCase().includes(searchTerm)
    );
    
    // Call renderUsers with the filtered array (no new fetch call)
    renderUsers(filteredUsers);
});