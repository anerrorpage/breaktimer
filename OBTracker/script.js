let currentRow = -1;

function addTimestamp(type) {
    const table = document.getElementById('breakTable').getElementsByTagName('tbody')[0];
    const now = new Date();
    const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    const formattedDate = now.toLocaleDateString('en'); // Use consistent date format
    const displayTime = `${formattedDate} ${formattedTime}`;
    const errorMessage = document.getElementById('errorMessage');

    if (type === 'out') {
        // If there is an incomplete record, show an error message
        if (currentRow >= 0 && table.rows[currentRow].cells[1].innerText === '---') {
            errorMessage.style.display = 'block';
            return;
        }

        currentRow++;
        const row = table.insertRow(currentRow);
        row.insertCell(0).innerText = displayTime;
        row.insertCell(1).innerText = '---';
        row.insertCell(2).innerText = '00:00';
        const notesCell = row.insertCell(3);
        notesCell.appendChild(createDropdown());
        document.getElementById('outButton').disabled = true; // Disable 'Out' button
        document.getElementById('inButton').disabled = false; // Enable 'In' button
        errorMessage.style.display = 'none'; // Hide error message
    } else if (type === 'in' && currentRow >= 0) {
        const row = table.rows[currentRow];
        row.cells[1].innerText = displayTime;

        const outDateTime = new Date(row.cells[0].innerText);
        const inDateTime = new Date(displayTime);

        const breakTime = calculateBreakTime(outDateTime, inDateTime);
        row.cells[2].innerText = breakTime;
        updateTotalBreakTime();
        document.getElementById('outButton').disabled = false; // Enable 'Out' button
        document.getElementById('inButton').disabled = true; // Disable 'In' button
    }
}

function createDropdown() {
    const select = document.createElement('select');
    select.className = 'dropdown';
    select.innerHTML = `
        <option value="">Select...</option>
        <option value="Away">Away</option>
        <option value="Mobile Usage">Mobile Usage</option>
        <option value="Sleeping">Sleeping</option>
    `;
    return select;
}

function calculateBreakTime(outTime, inTime) {
    const diffMs = inTime - outTime;
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffMins = Math.floor((diffMs % 3600000) / 60000);
    return `${pad(diffHrs)}:${pad(diffMins)}`;
}

function pad(number) {
    return number < 10 ? `0${number}` : number;
}

function updateTotalBreakTime() {
    const table = document.getElementById('breakTable').getElementsByTagName('tbody')[0];
    let totalMs = 0;

    for (let i = 0; i < table.rows.length; i++) {
        const cells = table.rows[i].cells;
        const [hrs, mins] = cells[2].innerText.split(':').map(Number);
        totalMs += ((hrs * 60 + mins) * 60) * 1000;
    }

    const totalHrs = Math.floor(totalMs / 3600000);
    const totalMins = Math.floor((totalMs % 3600000) / 60000);

    document.getElementById('totalBreakTime').innerText = `${pad(totalHrs)}:${pad(totalMins)}`;

    const allowableBreakMs = (1 * 3600 + 20 * 60) * 1000;
    const overBreakMs = Math.max(totalMs - allowableBreakMs, 0);

    const overHrs = Math.floor(overBreakMs / 3600000);
    const overMins = Math.floor((overBreakMs % 3600000) / 60000);

    document.getElementById('overBreakTime').innerText = `${pad(overHrs)}:${pad(overMins)}`;
}

function saveToFile() {
    const table = document.getElementById('breakTable').getElementsByTagName('tbody')[0];
    const summary = document.querySelectorAll('.summary div span');
    const today = new Date();
    const formattedDate = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    let content = '';

    // Loop through table rows to collect data
    for (let i = 0; i < table.rows.length; i++) {
        const cells = table.rows[i].cells;
        const outTime = cells[0].innerText.trim();
        const inTime = cells[1].innerText.trim();
        const breakTime = cells[2].innerText.trim();
        const notes = cells[3].querySelector('select').value;

        content += `${outTime} - ${inTime} - ${breakTime} - ${notes}\n`;
    }

    // Add summary data
    content += `\nTotal Break: ${document.getElementById('totalBreakTime').innerText}`;

    // Create a Blob with the content
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    // Create a link element, simulate click and clean up
    const a = document.createElement('a');
    a.href = url;
    a.download = `${formattedDate}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function clearContent() {
    const confirmation = confirm("Are you sure you want to clear the table?");
    if (confirmation) {
        const table = document.getElementById('breakTable').getElementsByTagName('tbody')[0];
        table.innerHTML = ''; // Clear all rows
        currentRow = -1; // Reset current row index
        document.getElementById('totalBreakTime').innerText = '00:00';
        document.getElementById('overBreakTime').innerText = '00:00';
        document.getElementById('outButton').disabled = false; // Enable 'Out' button
        document.getElementById('inButton').disabled = true; // Disable 'In' button
        document.getElementById('errorMessage').style.display = 'none'; // Hide error message
    }
}

function initializePage() {
    loadDataFromStorage();
    loadBackgroundFromStorage();
}


// Function to initialize IndexedDB
function initializeDB() {
    const dbName = 'BreakTimeDB';
    const dbVersion = 1;

    const request = window.indexedDB.open(dbName, dbVersion);

    request.onerror = function(event) {
        console.error('IndexedDB error:', event.target.errorCode);
    };

    request.onsuccess = function(event) {
        db = event.target.result;
        console.log('IndexedDB opened successfully');
        loadDataFromDB();
    };

    request.onupgradeneeded = function(event) {
        const db = event.target.result;
        const objectStore = db.createObjectStore('breakTime', { keyPath: 'id', autoIncrement: true });

        // Define the schema if needed
        objectStore.createIndex('outTime', 'outTime', { unique: false });
        objectStore.createIndex('inTime', 'inTime', { unique: false });
        objectStore.createIndex('breakTime', 'breakTime', { unique: false });
        objectStore.createIndex('notes', 'notes', { unique: false });

        console.log('IndexedDB upgrade complete');
    };
}


// Function to save data to IndexedDB
function saveDataToDB() {
    const transaction = db.transaction(['breakTime'], 'readwrite');
    const store = transaction.objectStore('breakTime');

    // Clear existing data
    store.clear();

    const table = document.getElementById('breakTable').getElementsByTagName('tbody')[0];

    // Loop through table rows to save data
    for (let i = 0; i < table.rows.length; i++) {
        const cells = table.rows[i].cells;
        const data = {
            outTime: cells[0].innerText.trim(),
            inTime: cells[1].innerText.trim(),
            breakTime: cells[2].innerText.trim(),
            notes: cells[3].querySelector('select').value
        };

        // Add data to the object store
        store.add(data);
    }

    // Handle transaction completion
    transaction.oncomplete = function() {
        console.log('Data saved to IndexedDB');
    };

    transaction.onerror = function(event) {
        console.error('Error saving data:', event.target.errorCode);
    };
}

// Function to load data from IndexedDB
function loadDataFromDB() {
    const transaction = db.transaction(['breakTime'], 'readonly');
    const store = transaction.objectStore('breakTime');
    const request = store.getAll();

    request.onsuccess = function(event) {
        const data = event.target.result;

        if (data) {
            // Load total break time and over break time
            document.getElementById('totalBreakTime').innerText = '00:00'; // Modify as per your saved data structure
            document.getElementById('overBreakTime').innerText = '00:00'; // Modify as per your saved data structure

            const table = document.getElementById('breakTable').getElementsByTagName('tbody')[0];
            table.innerHTML = ''; // Clear existing rows

            data.forEach(rowData => {
                const row = table.insertRow();
                row.insertCell().innerText = rowData.outTime;
                row.insertCell().innerText = rowData.inTime;
                row.insertCell().innerText = rowData.breakTime;

                const notesCell = row.insertCell();
                notesCell.appendChild(createDropdown());
                const dropdown = notesCell.querySelector('select');
                dropdown.value = rowData.notes;
            });

            // Update currentRow variable if needed
            currentRow = data.length - 1;
        }
    };

    transaction.onerror = function(event) {
        console.error('Error loading data:', event.target.errorCode);
    };
}

// Replace existing localStorage functions with IndexedDB equivalents
function initializePage() {
    initializeDB();
}


window.addEventListener('beforeunload', function() {
    saveDataToDB();
});

document.addEventListener('DOMContentLoaded', function() {
    const body = document.body;
    const toggleButton = document.getElementById('toggleButton');

    // Check for saved dark mode preference in localStorage
    const darkMode = localStorage.getItem('darkMode');

    if (darkMode === 'enabled') {
        body.classList.add('dark-mode');
    }

    toggleButton.addEventListener('click', function() {
        body.classList.toggle('dark-mode');

        // Save the dark mode preference in localStorage
        if (body.classList.contains('dark-mode')) {
            localStorage.setItem('darkMode', 'enabled');
        } else {
            localStorage.removeItem('darkMode');
        }
    });
});

document.addEventListener('DOMContentLoaded', () => {
            const bgButton = document.getElementById('bgButton');
            const bgInput = document.getElementById('bgInput');
            const bgPreview = document.getElementById('bgPreview');

            // Load background image from localStorage
            function loadBackgroundFromStorage() {
                const savedImage = localStorage.getItem('backgroundImage');
                if (savedImage) {
                    document.body.style.backgroundImage = `url(${savedImage})`;
                    bgPreview.src = savedImage;
                    bgPreview.style.display = 'block';
                }
            }

            // Save background image to localStorage
            function saveBackgroundToStorage(image) {
                localStorage.setItem('backgroundImage', image);
            }
			
			// Remove background image from localStorage
            function removeBackgroundFromStorage() {
                localStorage.removeItem('backgroundImage');
            }

            // Call the load function when the DOM is loaded
            loadBackgroundFromStorage();

            bgButton.addEventListener('click', () => {
                bgInput.click();
            });

            bgInput.addEventListener('change', (event) => {
                const file = event.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const image = e.target.result;
                        document.body.style.backgroundImage = `url(${image})`;
                        bgPreview.src = image;
                        bgPreview.style.display = 'block';
                        saveBackgroundToStorage(image);
                    };
                    reader.readAsDataURL(file);
                }
            });
			
			removeBgButton.addEventListener('click', () => {
                document.body.style.backgroundImage = '';
                bgPreview.style.display = 'none';
                removeBackgroundFromStorage();
            });
        });

function showPage(pageId) {
            var pages = document.getElementsByClassName('page');
            for (var i = 0; i < pages.length; i++) {
                pages[i].style.display = 'container';
            }
            document.getElementById(pageId).style.display = 'block';
        }

// Initialize the page
initializePage();


