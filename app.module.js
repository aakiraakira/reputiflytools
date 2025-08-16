
  // Import the functions you need from the SDKs
  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
  import {
    getAuth,
    onAuthStateChanged,
  } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
  import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
  import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

  // Your web app's Firebase configuration
  const firebaseConfig = {
  apiKey: "AIzaSyB5GkZzQaHF9WLBpHIzgTbUDshtb0-TsFM",
  authDomain: "reputifly-notes.firebaseapp.com",
  projectId: "reputifly-notes",
  storageBucket: "reputifly-notes.firebasestorage.app",
  messagingSenderId: "1085743658227",
  appId: "1:1085743658227:web:d90ba48b3b2df9fe1d3386"
};

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  
  // CORRECTED PART: Make auth and db globally available
  // CORRECTED PART: Make auth and db globally available
window.auth = getAuth(app);

// --- ADD THIS BLOCK TO ENABLE OFFLINE ---
const db = getFirestore(app);
enableIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      // This can happen if you have multiple tabs open.
      console.warn("Firestore persistence failed: multiple tabs open.");
    } else if (err.code == 'unimplemented') {
      // The browser is likely too old to support this feature.
      console.error("Firestore persistence is not supported in this browser.");
    }
  });
// --- END OF NEW BLOCK ---

window.db = db; // This now uses the offline-enabled db instance
window.functions = getFunctions(app,);
    

  // This is our new entry point!
  // This is our new entry point!
  // This is our new entry point!
  onAuthStateChanged(window.auth, (user) => {
    // --- ADD THESE TWO LINES ---
    const params = new URLSearchParams(window.location.search);
    if (params.has('view')) return; // If it's a share link, STOP here.

    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    
    // START: MODIFIED SECTION
    const chatbotFab = document.getElementById('chatbot-fab');
    const mobileFab = document.getElementById('mobile-new-note-fab');
    // END: MODIFIED SECTION

    if (user) {
          // User is signed in.
          console.log('User is logged in:', user.uid);
          if (authContainer) authContainer.style.display = 'none';
          if (appContainer) appContainer.style.display = 'flex';
          
          // START: MODIFIED SECTION
          // Restore button visibility
          if (chatbotFab) chatbotFab.style.display = 'flex';
          if (mobileFab) mobileFab.style.display = 'flex'; // CSS will handle hiding on desktop
          // END: MODIFIED SECTION

          // --- START: PROFILE LOGIC ---
          const userInitial = document.getElementById('user-initial');
          const userEmailDisplay = document.getElementById('user-email-display');
          const profileButton = document.getElementById('profile-button');
          const profileDropdown = document.getElementById('profile-dropdown');
          const signOutLink = document.getElementById('sign-out-link');

          if (user.email) {
              userInitial.textContent = user.email.charAt(0).toUpperCase();
              userEmailDisplay.textContent = user.email;
              userEmailDisplay.title = user.email;
          }

          if(profileButton) { // Check if button exists before adding listener
            profileButton.addEventListener('click', (e) => {
                e.stopPropagation();
                if(profileDropdown) profileDropdown.classList.toggle('hidden');
                // Re-render icons if the dropdown is shown
                if (profileDropdown && !profileDropdown.classList.contains('hidden')) {
                  feather.replace();
                }
            });
          }

          if(signOutLink) { // Check if link exists
  signOutLink.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
          // Import the necessary functions from Firebase SDKs
          const { signOut } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
          const { terminate } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

          // 1. Terminate the Firestore instance to clear the local IndexedDB cache
          if (window.db) {
              await terminate(window.db);
              console.log("Firestore instance terminated and cache cleared.");
          }

          // 2. Sign the user out
          await signOut(window.auth);

          // 3. Reload the page to ensure a completely clean state for the next user
          window.location.reload();

      } catch (error) {
          console.error('Sign out process failed:', error);
          // As a fallback, still try to sign out and reload to be safe
          const { signOut } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
          await signOut(window.auth).catch(e => console.error("Fallback signout failed", e));
          window.location.reload();
      }
  });
}
          // --- END: PROFILE LOGIC ---
          
          // Make sure init() is defined before calling it
          if (window.appInit) {
              window.appInit();
          }
      } else {
      // User is signed out.
      console.log('User is logged out.');
      if (authContainer) authContainer.style.display = 'flex';
      if (appContainer) appContainer.style.display = 'none';

      // START: MODIFIED SECTION
      // Hide buttons on login/signup page
      if (chatbotFab) chatbotFab.style.display = 'none';
      if (mobileFab) mobileFab.style.display = 'none';
      // END: MODIFIED SECTION
    }
  });


/* ===== next module block ===== */


        feather.replace();

        document.addEventListener('DOMContentLoaded', async () => {
            // PASTE THIS ENTIRE BLOCK RIGHT AFTER the 'DOMContentLoaded' line

// ==================================================================
//  START: CORRECT FUNCTION BLOCK
// ==================================================================
// ==================================================================
//  START: UPGRADED FUNCTION BLOCK
// ==================================================================
// ==================================================================
//  START: CORRECT FUNCTION BLOCK
// ==================================================================
// ==================================================================
//  START: UPGRADED FUNCTION BLOCK
// ==================================================================
// --- START: NEW CURSOR MANAGEMENT HELPERS ---
// --- START: NEW MARKDOWN FORMATTING FUNCTION ---
const handleMarkdownFormatting = () => {
    const editor = app.elements.noteEditorBody;
    const originalContent = editor.innerHTML;
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);

    // 1. Insert an invisible "bookmark" span at the cursor's position
    const cursorMarker = document.createElement('span');
    cursorMarker.id = 'cursor-marker';
    range.insertNode(cursorMarker);

    let newContent = editor.innerHTML;

    // Regular expressions for formatting
    const formats = [
        { regex: /(?<!\*)\*([^\*\s][^\*]*?)\*(?!\*)/g, replacement: '<strong>$1</strong>' }, // Bold
        { regex: /(?<!_)_([^_`\s][^_`]*?)_(?!_)/g, replacement: '<em>$1</em>' },          // Italic
        { regex: /(?<!~)~([^~\s][^~]*?)~(?!~)/g, replacement: '<s>$1</s>' },            // Strikethrough
        { regex: /(?<!`)`([^`\s][^`]*?)`(?!`)/g, replacement: '<code>$1</code>' }            // Inline Code
    ];

    formats.forEach(format => {
        newContent = newContent.replace(format.regex, format.replacement);
    });

    if (newContent !== originalContent) {
        // 2. Update the editor's content
        editor.innerHTML = newContent;

        // 3. Find our bookmark
        const marker = editor.querySelector('#cursor-marker');
        if (marker) {
            // 4. Create a new cursor position right before the bookmark
            const newRange = document.createRange();
            newRange.setStartBefore(marker);
            newRange.collapse(true);

            // 5. Apply the new cursor position
            selection.removeAllRanges();
            selection.addRange(newRange);

            // 6. Remove the invisible bookmark
            marker.parentNode.removeChild(marker);
        }
    } else {
        // If no formatting happened, just remove the marker we added
        cursorMarker.parentNode.removeChild(cursorMarker);
    }
};
// --- END: NEW MARKDOWN FORMATTING FUNCTION ---
// --- END: NEW MARKDOWN FORMATTING FUNCTION ---
// --- END: NEW MARKDOWN FORMATTING FUNCTION ---
// --- END: NEW CURSOR MANAGEMENT HELPERS ---
const formatRelativeTime = (isoString) => {
    const date = new Date(isoString);
    const now = new Date();
    const seconds = Math.round((now - date) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
};

const displayVersionDiff = (selectedVersionContent) => {
    const viewer = document.getElementById('version-content-viewer');
    
    // Sanitize the historical content before adding it to the viewer
    viewer.innerHTML = DOMPurify.sanitize(selectedVersionContent);
    
    // Re-render Feather icons inside the new preview content.
    feather.replace();
};
// --- Manual Checkpoint Listener ---
// --- Manual Checkpoint Listener ---
// --- Manual Checkpoint Listener ---
document.getElementById('header-checkpoint-btn').addEventListener('click', async () => {
    const noteId = state.settings.activeNoteId;
    if (!noteId) return showToast('Please select a note first.', 'info');

    const message = await showPrompt({
        title: 'Save Checkpoint',
        message: 'Add a short message to describe this version:',
        placeholder: 'e.g., Initial draft completed'
    });

    if (message) {
        // FIX: Get the full note data from the cache, which includes the content.
        const noteData = window.noteCache[noteId];
        if (noteData) {
            saveNoteVersion(noteId, noteData.content, message);
            saveState(); // Persist the new version
            showToast('✅ Checkpoint saved!', 'success');
        }
    }
});
/**
 * Opens the redesigned Version History modal and sets up interactions.
 */
const closeVersionHistoryModal = () => {
    closeModal(document.getElementById('version-history-modal'));
};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-ripple]');
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const circle = document.createElement('span');
  const d = Math.max(rect.width, rect.height);
  circle.className = 'ripple';
  circle.style.width = circle.style.height = d + 'px';
  circle.style.left = (e.clientX - rect.left - d/2) + 'px';
  circle.style.top  = (e.clientY - rect.top  - d/2) + 'px';
  el.appendChild(circle);
  circle.addEventListener('animationend', () => circle.remove());
}, { passive: true });

/* ---- Tilt: add slight 3D hover to .tilt cards ---- */
const tiltEls = new Set();
const activateTilt = (root = document) => {
  root.querySelectorAll('.tilt').forEach(el => tiltEls.add(el));
};
activateTilt(document);
const clamp = (n, min, max) => Math.max(min, Math.min(n, max));
document.addEventListener('mousemove', (e) => {
  tiltEls.forEach(el => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width/2, cy = r.top + r.height/2;
    const dx = clamp((e.clientX - cx)/r.width, -0.5, 0.5);
    const dy = clamp((e.clientY - cy)/r.height, -0.5, 0.5);
    el.style.setProperty('--tilt-x',  (dy * -6) + 'deg');
    el.style.setProperty('--tilt-y',  (dx *  6) + 'deg');
  });
}, { passive: true });

/* Mark common cards as tilt-enabled without touching your renderers */
const tiltObserver = new MutationObserver(() => {
  activateTilt(document);
});
tiltObserver.observe(document.documentElement, { subtree: true, childList: true });

/* ---- Smarter header hide on scroll ---- */
(() => {
  const header = document.getElementById('main-header');
  if (!header) return;
  let lastY = window.scrollY, hidden = false, threshold = 8;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    const dy = y - lastY;
    if (dy > threshold && !hidden) { header.classList.add('header-hidden'); hidden = true; }
    else if (dy < -threshold && hidden) { header.classList.remove('header-hidden'); hidden = false; }
    lastY = y;
  }, { passive: true });
})();
const openVersionHistoryModal = async () => {
    const noteId = state.settings.activeNoteId;
    if (!noteId) return;

    const modal = document.getElementById('version-history-modal');
    const listContainer = document.getElementById('version-list-container');
    const searchInput = document.getElementById('version-search-input');
    
    // Show a loading state while fetching versions from the database.
    listContainer.innerHTML = `<p class="p-4 text-sm text-center text-text-tertiary">Loading history...</p>`;
    openModal(modal);

    // Fetch the last 50 versions, ordered by most recent.
    const { collection, query, orderBy, getDocs, limit } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    const versionsColRef = collection(db, "notes", noteId, "versions");
    const versionsQuery = query(versionsColRef, orderBy("savedAt", "desc"), limit(50));
    
    const snapshot = await getDocs(versionsQuery);
    const allVersions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // The rest of the function will now use `allVersions` fetched from Firestore.

    const formatDateHeader = (timestamp) => {
    // Gracefully handle the case where a timestamp might not exist yet
    if (!timestamp) return 'Just Now';
    const date = timestamp.toDate();
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        today.setHours(0, 0, 0, 0);
        yesterday.setHours(0, 0, 0, 0);
        date.setHours(0, 0, 0, 0);

        if (date.getTime() === today.getTime()) return 'Today';
        if (date.getTime() === yesterday.getTime()) return 'Yesterday';
        
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    };

    // Located inside the init() function
const renderVersionList = (filteredVersions) => {
        if (filteredVersions.length === 0) {
            listContainer.innerHTML = `<p class="p-4 text-sm text-center text-text-tertiary">No matching versions found.</p>`;
            document.getElementById('version-content-viewer').innerHTML = '';
            document.getElementById('version-restore-btn').style.display = 'none';
            return;
        }

        const groupedVersions = {};
        filteredVersions.forEach(version => {
            const header = formatDateHeader(version.savedAt);
            if (!groupedVersions[header]) groupedVersions[header] = [];
            // We no longer need originalIndex, we'll use the real document ID
groupedVersions[header].push({ ...version });
        });

        let finalHTML = '';
        for (const header in groupedVersions) {
            finalHTML += `<h4 class="version-group-header">${header}</h4>`;
            finalHTML += groupedVersions[header].map(versionData => {
            
                const { savedAt, message, content, id: versionDocId } = versionData;
const formattedDate = savedAt ? savedAt.toDate().toLocaleString() : 'Saving...';
const relativeTime = savedAt ? formatRelativeTime(savedAt.toDate().toISOString()) : 'Just now';
                
                return `
<div class="version-item group flex items-center justify-between" data-version-id="${versionDocId}" title="${formattedDate}">
    <div class="version-item-content flex-grow cursor-pointer p-2 -m-2">
        <div class="version-timestamp">${relativeTime}</div>
        <div class="version-fulldate">${formattedDate}</div>
        ${message ? `<div class="version-message">${message.replace(/</g, "&lt;")}</div>` : ''}
    </div>
    <button class="delete-version-btn p-1.5 rounded-full text-text-tertiary hover:text-red-500 hover:bg-bg-pane-dark opacity-0 group-hover:opacity-100 transition-opacity" data-action="delete-version" data-version-id="${versionDocId}" title="Delete this version">
        <i data-feather="trash-2" class="w-4 h-4 pointer-events-none"></i>
    </button>
</div>
`;
            }).join('');
        }
        
        document.getElementById('version-restore-btn').style.display = 'inline-flex';
        listContainer.innerHTML = finalHTML;
        
        const firstItem = listContainer.querySelector('.version-item');
        if (firstItem) {
            displayVersionDiff(filteredVersions[0].content);
            firstItem.classList.add('active');
        }
        feather.replace();
    };

    searchInput.value = '';
    renderVersionList(allVersions);

    const handleSearch = () => {
        const query = searchInput.value.toLowerCase().trim();
        const filtered = query ? allVersions.filter(v => 
            (v.content || '').toLowerCase().includes(query) || 
            (v.message || '').toLowerCase().includes(query)
        ) : allVersions;
        renderVersionList(filtered);
    };

    if (!searchInput.hasAttribute('data-listener-added')) {
        searchInput.addEventListener('input', debounce(handleSearch, 200));
        searchInput.setAttribute('data-listener-added', 'true');
    }
    
    openModal(modal);
    feather.replace();
};

const saveNoteVersion = async (noteId, content, message = null) => {
    // This now saves each version as its own document in a Firestore subcollection.
    try {
        const { doc, collection, addDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        
        const versionsColRef = collection(db, "notes", noteId, "versions");
        
        await addDoc(versionsColRef, {
            content: content,
            message: message,
            savedAt: serverTimestamp() // Use Firestore's reliable timestamp.
        });
        
    } catch (error) {
        console.error("Failed to save note version to Firestore:", error);
        showToast("Error saving note version.", 'error');
    }
};

document.getElementById('version-history-close-btn').addEventListener('click', closeVersionHistoryModal);

// Located inside the init() function
// Located inside the init() function
document.getElementById('version-sidebar').addEventListener('click', async (e) => {
    const noteId = state.settings.activeNoteId;
    if (!noteId) return;

    // --- NEW: LOGIC TO DELETE A VERSION ---
    const deleteBtn = e.target.closest('.delete-version-btn');
    if (deleteBtn) {
        e.stopPropagation(); // Stop the click from also selecting the item
        const versionId = deleteBtn.dataset.versionId;
        if (!versionId) return;

        try {
            const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
            const versionRef = doc(db, "notes", noteId, "versions", versionId);
            await deleteDoc(versionRef);
            openVersionHistoryModal(); // Refresh the modal to show the updated list
            showToast('Version deleted successfully.', 'success');
        } catch (error) {
            console.error("Failed to delete version:", error);
            showToast('Could not delete version.', 'error');
        }
        return; // Action complete
    }

    // --- NEW: LOGIC TO VIEW A VERSION ---
    const versionItem = e.target.closest('.version-item');
    if (versionItem && !versionItem.classList.contains('active')) {
        document.querySelectorAll('#version-sidebar .version-item.active').forEach(el => el.classList.remove('active'));
        versionItem.classList.add('active');

        const versionId = versionItem.dataset.versionId;
        if (!versionId) return;

        try {
            const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
            const versionRef = doc(db, "notes", noteId, "versions", versionId);
            const versionSnap = await getDoc(versionRef);

            if (versionSnap.exists()) {
                displayVersionDiff(versionSnap.data().content);
            }
        } catch (error) {
            console.error("Failed to display version:", error);
            showToast('Could not load selected version.', 'error');
        }
    }
});

// Find and replace the version history close button listener
document.getElementById('version-history-close-btn').addEventListener('click', closeVersionHistoryModal);


// Remove the old listener on 'version-list-container' and add these new ones
document.getElementById('version-sidebar').addEventListener('click', (e) => {
    const versionItem = e.target.closest('.version-item');
    if (!versionItem || versionItem.classList.contains('active')) return;

    // Remove active class from any other item
    document.querySelectorAll('#version-sidebar .version-item.active').forEach(el => el.classList.remove('active'));
    // Add active class to the clicked item
    versionItem.classList.add('active');

    const noteId = state.settings.activeNoteId;
    const versions = state.versions?.[noteId] || [];
    const selectedIndex = parseInt(versionItem.dataset.versionIndex);
    const selectedVersion = versions[selectedIndex];

    if (selectedVersion) {
        displayVersionDiff(selectedVersion.content);
    }
});

// --- Integrated Version Restore Logic ---
// --- Integrated Version Restore Logic ---
let restoreConfirmTimeout; 

document.getElementById('version-restore-btn').addEventListener('click', async (e) => {
    const restoreBtn = e.currentTarget;
    const noteId = state.settings.activeNoteId;
    const activeItem = document.querySelector('#version-sidebar .version-item.active');

    if (!noteId || !activeItem) return;

    if (restoreBtn.classList.contains('confirm-state')) {
        clearTimeout(restoreConfirmTimeout);

        // --- THIS IS THE FIX ---
        // Get the unique ID from the selected version item
        const versionId = activeItem.dataset.versionId;
        if (!versionId) {
            showToast('Could not find version ID.', 'error');
            return;
        }

        try {
            // Fetch that specific version directly from Firestore
            const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
            const versionRef = doc(db, "notes", noteId, "versions", versionId);
            const versionSnap = await getDoc(versionRef);

            if (versionSnap.exists()) {
                const versionToRestore = versionSnap.data();
                const noteData = window.noteCache[noteId];

                // Save a checkpoint of the current state before overwriting
                saveNoteVersion(noteId, noteData.content, `Automatic checkpoint before restore`);

                // Overwrite the note's content with the restored version
                noteData.content = versionToRestore.content;
                noteData.modifiedAt = new Date().toISOString();
                updateNoteLinks(noteData);
                updateNoteTags(noteData);

                // Update the UI and save everything to the database
                // Update the UI and save everything to the database
app.elements.noteEditorBody.innerHTML = noteData.content;

// --- THIS IS THE FIX ---
// Mark the note as "dirty" so that performImmediateSave knows it needs to save the new content
isNoteDirty = true;
// --- END OF FIX ---

await performImmediateSave();
buildLunrIndex();

                closeVersionHistoryModal();
                showToast('Note restored successfully!', 'success');
            } else {
                throw new Error("Version document not found.");
            }
        } catch (error) {
            console.error("Error restoring version:", error);
            showToast('Failed to restore version.', 'error');
        }
        
        restoreBtn.classList.remove('confirm-state');
        restoreBtn.textContent = 'Restore';

    } else {
        // This part handles the "Confirm Restore?" state
        restoreBtn.classList.add('confirm-state');
        restoreBtn.textContent = 'Confirm Restore?';

        restoreConfirmTimeout = setTimeout(() => {
            restoreBtn.classList.remove('confirm-state');
            restoreBtn.textContent = 'Restore';
        }, 3000);
    }
});
const updateChecklistProgress = (checklistContainer) => {
    if (!checklistContainer) return;
    const items = checklistContainer.querySelectorAll('.checklist-item');
    const checkedItems = checklistContainer.querySelectorAll('.checklist-item.checked');
    const total = items.length;
    const checkedCount = checkedItems.length;
    const percentage = total > 0 ? Math.round((checkedCount / total) * 100) : 0;
    const fillEl = checklistContainer.querySelector('.checklist-progress-fill');
    const textEl = checklistContainer.querySelector('.checklist-progress-text');
    if (fillEl) fillEl.style.width = `${percentage}%`;
    if (textEl) textEl.textContent = `${percentage}% Complete`;
};

// --- 1. HELPER FUNCTIONS (Lowest Level) ---
// These are needed by other functions, so they must come first.

function findItem(itemId, tree = state.collections) {
    if (!itemId) return null;
    for (let i = 0; i < tree.length; i++) {
        const item = tree[i];
        if (item.id === itemId) return {item, parent: tree, index: i};
        if (item.children) {
            const result = findItem(itemId, item.children);
            if(result) {
               const parentObject = tree.find(parentItem => parentItem.children === result.parent);
               return { ...result, parent: parentObject || tree };
            }
        }
    }
    return null;
}
const handleSpreadsheetUpload = (file) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (json.length === 0) {
                showToast('Spreadsheet is empty.', 'error');
                return;
            }

            const [headers, ...rows] = json;
            const cols = headers.length;

            let tableHTML = '<table style="width:100%"><thead>';
            tableHTML += `<tr><th colspan="${cols}" contenteditable="false"><div class="table-header-controls"><div class="table-filter-wrapper flex-grow"><i data-feather="search" class="filter-icon"></i><input class="table-filter-input" placeholder="Filter table..."/></div><button class="toggle-filter-btn" title="Toggle Filter"><i data-feather="chevrons-up" class="w-4 h-4"></i></button><button class="delete-table-btn" title="Delete Table"><i data-feather="trash-2" class="w-4 h-4"></i></button></div></th></tr>`;
            tableHTML += '<tr>';
            headers.forEach(header => {
                tableHTML += `<th class="sortable-header" data-sort-dir="none" contenteditable="true">${header}</th>`;
            });
            tableHTML += '</tr></thead><tbody>';

            rows.forEach(row => {
                tableHTML += '<tr>';
                for (let i = 0; i < cols; i++) {
                    tableHTML += `<td contenteditable="true">${row[i] || ''}</td>`;
                }
                tableHTML += '</tr>';
            });

            tableHTML += '</tbody></table><p><br></p>';

            restoreSelectionAndExec(() => document.execCommand('insertHTML', false, tableHTML));
            feather.replace();
            showToast(`✅ Table imported from ${file.name}`);

        } catch (err) {
            console.error("Spreadsheet parsing error:", err);
            showToast("Failed to parse the spreadsheet file.", "error");
        }
    };
    reader.readAsArrayBuffer(file);
};
/**
 * Renders the flashcard data into the modal and handles the UI logic.
 * @param {Array<Object>} cards - An array of flashcard objects [{front, back}].
 */
function renderFlashcardModal(cards) {
    // Get fresh references to all modal elements each time
    const modal = document.getElementById('flashcard-modal');
    const container = document.getElementById('flashcard-container');
    const frontEl = document.getElementById('flashcard-front');
    const backEl = document.getElementById('flashcard-back');
    const progressEl = document.getElementById('flashcard-progress');
    const prevBtn = document.getElementById('flashcard-prev-btn');
    const nextBtn = document.getElementById('flashcard-next-btn');
    const closeBtn = document.getElementById('flashcard-close-btn');

    let currentIndex = 0;

    // --- All event logic is handled by this one function ---
    const handleModalClick = (e) => {
        // Use .closest() to see if a specific button was clicked
        const targetButton = e.target.closest('button');

        if (targetButton === prevBtn) {
            if (currentIndex > 0) {
                currentIndex--;
                updateCard();
            }
        } else if (targetButton === nextBtn) {
            if (currentIndex < cards.length - 1) {
                currentIndex++;
                updateCard();
            } else {
                cleanupAndClose(); // Finish on the last card
            }
        } else if (targetButton === closeBtn) {
            cleanupAndClose();
        } else {
            // If any other part of the modal is clicked, flip the card
            container.classList.toggle('flipped');
        }
    };

    // This function updates the card's content
    const updateCard = () => {
        container.classList.remove('flipped'); // Always show the front first

        // Use marked.parse to correctly render potential markdown from the AI
        frontEl.innerHTML = marked.parse(cards[currentIndex].front || '');
        backEl.innerHTML = marked.parse(cards[currentIndex].back || '');

        progressEl.textContent = `Card ${currentIndex + 1} of ${cards.length}`;
        prevBtn.disabled = currentIndex === 0;
        nextBtn.textContent = (currentIndex === cards.length - 1) ? 'Finish' : 'Next';
    };

    // This function removes the event listener to prevent future bugs
    const cleanupAndClose = () => {
        modal.removeEventListener('click', handleModalClick);
        closeModal(modal);
    };

    // --- Setup ---
    modal.addEventListener('click', handleModalClick); // Add the single listener
    updateCard(); // Display the first card
    openModal(modal);
    feather.replace();
}

/**
 * Handles the AI call to generate flashcards from note content, with caching.
 * @param {Object} note - The full note object from the state.
 */
const handleFlashcardMode = async (note) => {
    // Step 1: Check for a valid cached result first.
    if (note.cachedFlashcards && note.cachedFlashcards.sourceModifiedAt === note.modifiedAt) {
        showToast('Loading Flashcards!', 'info');
        renderFlashcardModal(note.cachedFlashcards.data);
        return;
    }

    // Step 2: If no cache, call the AI.
    const noteContent = (note.content || '').replace(/<[^>]*>?/gm, '').trim();
    if (!noteContent) {
        showToast("Note is empty, cannot generate flashcards.", "info");
        return;
    }

    const toastId = showToast('Generating Flashcards...', 'loading');
    const prompt = `Analyze the following text and identify the key concepts. Create a series of flashcards based on these concepts. For each flashcard, provide a "front" (a question or term) and a "back" (the answer or definition). Return the result as a single, valid JSON object with a key "flashcards" which is an array of objects. Each object in the array must have two keys: "front" (string) and "back" (string). Do not include any text or markdown formatting outside of the JSON object.
    Text:
    ---
    ${noteContent}`;

    const payload = { contents: [{ parts: [{ text: prompt }] }] };
    const jsonResponse = await callGeminiAPI(payload);
    dismissToast(toastId);

    if (jsonResponse) {
        try {
    // Find the start and end of the JSON object
    const startIndex = jsonResponse.indexOf('{');
    const endIndex = jsonResponse.lastIndexOf('}');

    // Extract only the JSON part of the string
    const jsonString = jsonResponse.substring(startIndex, endIndex + 1);

    const flashcardData = JSON.parse(jsonString);

    if (flashcardData.flashcards && Array.isArray(flashcardData.flashcards)) {
         renderFlashcardModal(flashcardData.flashcards);

         // Cache the new result in the note object.
         note.cachedFlashcards = {
             sourceModifiedAt: note.modifiedAt,
             data: flashcardData.flashcards
         };
         saveState(); // Save the note with the cached data.
    } else {
        throw new Error("Invalid flashcard data structure in JSON.");
    }
} catch (err) {
    console.error("Failed to parse flashcard JSON:", err, "Raw response:", jsonResponse);
    showToast('Failed to generate valid flashcards.', 'error');
}
    }
};
const getAllNotes = (items) => {
    let notes = [];
    for (const item of items) {
        if (item.type === 'note') {
            notes.push(item);
        }
        if (item.type === 'folder' && item.children) {
            notes = notes.concat(getAllNotes(item.children));
        }
    }
    return notes;
};
const getAllFolders = (items = state.collections) => {
    let folders = [];
    for (const item of items) {
        if (item.type === 'folder') {
            folders.push(item);
            if (item.children) {
                folders = folders.concat(getAllFolders(item.children));
            }
        }
    }
    return folders;
};
/**
 * Finds all HTML tables in a string and converts them to a plain-text Markdown format.
 * @param {string} htmlString - The HTML content of a note.
 * @returns {string} The content with tables converted to Markdown.
 */
function convertTablesToMarkdown(htmlString) {
    if (!htmlString || !htmlString.includes('<table')) return htmlString;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString;

    tempDiv.querySelectorAll('table').forEach(table => {
        let markdownTable = '\n';
        // Process Header
        const headers = table.querySelectorAll('thead tr:last-child th');
        if (headers.length > 0) {
            markdownTable += `| ${Array.from(headers).map(th => th.innerText.trim()).join(' | ')} |\n`;
            markdownTable += `| ${Array(headers.length).fill('---').join(' | ')} |\n`;
        }
        
        // Process Body
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            markdownTable += `| ${Array.from(cells).map(td => td.innerText.trim()).join(' | ')} |\n`;
        });

        table.outerHTML = markdownTable; // Replace the HTML table with the Markdown version
    });

    return tempDiv.innerHTML;
}
const handleGlobalAIQuery = async () => {
    const askBtn = document.getElementById('global-ai-ask-btn');
    const answerContainer = document.getElementById('global-ai-answer-container');
    const answerEl = document.getElementById('global-ai-answer');
    const inputEl = document.getElementById('global-ai-input');
    const sourcesContainer = document.getElementById('global-ai-sources-container');
    const copyBtnFooter = document.getElementById('global-ai-copy-btn-footer');
    const query = inputEl.value.trim();

    if (!query) return;

    askBtn.disabled = true;
    askBtn.querySelector('span').textContent = 'Thinking...';
    answerContainer.classList.add('hidden');
    sourcesContainer.classList.add('hidden');
    copyBtnFooter.classList.add('hidden');
    answerEl.innerHTML = '';

    const searchResults = lunrIndex.search(query);

    // --- FIX STARTS HERE ---
    // The original code used findItem(), which only returns a data stub.
    // This now correctly pulls the FULL note data from the global note cache.
    const topNotes = searchResults.slice(0, 5).map(res => {
        const fullNoteData = window.noteCache[res.ref];
        return fullNoteData ? { id: res.ref, ...fullNoteData } : null;
    }).filter(Boolean);
    // --- FIX ENDS HERE ---

    if (topNotes.length === 0) {
        showToast('No relevant notes found.', 'info');
        askBtn.disabled = false;
        askBtn.querySelector('span').textContent = 'Ask';
        return;
    }

    // This part now works correctly because note.content is available.
    const context = topNotes.map(note => {
        const contentWithMarkdownTables = convertTablesToMarkdown(note.content);
        return `--- Note: "${note.name}" ---\n${contentWithMarkdownTables.replace(/<[^>]*>?/gm, '')}`;
    }).join('\n\n');

    const historyContext = askYourNotesHistory.map(item => `Previous Question: ${item.question}\nPrevious Answer: ${item.answer}`).join('\n\n');

    const prompt = `You are a helpful assistant.
${historyContext ? `For context, here is the previous turn of our conversation:\n${historyContext}\n\n` : ''}
Based ONLY on the context from the provided notes below, answer the user's new question. If the answer cannot be found in the notes, say "I could not find an answer in your notes." Do not use any external knowledge.

User's Question: "${query}"

Context from Notes:
${context}`;

    const payload = { contents: [{ parts: [{ text: prompt }] }] };
    const aiResponse = await callGeminiAPI(payload);

    if (aiResponse) {
        answerEl.innerHTML = marked.parse(aiResponse);
        answerContainer.classList.remove('hidden');
        copyBtnFooter.classList.remove('hidden');

        findAndDisplaySourceSnippets(aiResponse, topNotes);

        askYourNotesHistory.push({ question: query, answer: aiResponse });
    } else {
        showToast('The AI could not provide an answer.', 'error');
    }

    askBtn.disabled = false;
    askBtn.querySelector('span').textContent = 'Ask';
    feather.replace();
};
const findAndDisplaySourceSnippets = (aiAnswer, sourceNotes) => {
    const sourcesEl = document.getElementById('global-ai-sources');
    const sourcesContainer = document.getElementById('global-ai-sources-container');
    sourcesEl.innerHTML = '';

    const stopWords = new Set(['a', 'an', 'the', 'is', 'was', 'are', 'in', 'on', 'of', 'to', 'and', 'it', 'for', 'from', 'your', 'notes']);
    const keywords = [...new Set(aiAnswer.toLowerCase().match(/\b(\w+)\b/g) || [])]
        .filter(word => word.length > 3 && !stopWords.has(word));

    if (keywords.length === 0) {
        sourcesContainer.classList.add('hidden');
        return;
    }

    // Calculate raw scores first
    const scoredNotes = sourceNotes.map(note => {
        const noteText = note.content.replace(/<[^>]*>?/gm, ' ').toLowerCase();
        let score = 0;
        keywords.forEach(kw => {
            if (noteText.includes(kw)) score++;
        });
        return { note, score };
    });

    const RELEVANCE_THRESHOLD_SCORE = 1; // Note must contain at least 1 keyword
    let relevantNotes = scoredNotes.filter(item => item.score > RELEVANCE_THRESHOLD_SCORE);
    
    // Calculate the total score for normalization
    const totalScore = relevantNotes.reduce((sum, item) => sum + item.score, 0);

    if (totalScore === 0) {
        sourcesContainer.classList.add('hidden');
        return;
    }

    let snippetsHTML = '';
    relevantNotes
      .sort((a, b) => b.score - a.score) // Sort by highest score
      .forEach(item => {
        // --- NEW: Normalization Logic ---
        const normalizedPercentage = Math.round((item.score / totalScore) * 100);

        let relevanceClass = 'bg-gray-600';
        if (normalizedPercentage > 40) relevanceClass = 'bg-green-500';
        else if (normalizedPercentage > 15) relevanceClass = 'bg-yellow-500';

        const noteText = item.note.content.replace(/<[^>]*>?/gm, ' ');
        let bestSnippet = `..."${noteText.substring(0, 120)}"...`;
        for (const kw of keywords) {
            const regex = new RegExp(`[^.!?]*\\b${kw}\\b[^.!?]*[.!?]`, 'i');
            const match = noteText.match(regex);
            if (match) {
                bestSnippet = `..."${match[0].trim()}"...`;
                break;
            }
        }
        keywords.forEach(kw => {
            bestSnippet = bestSnippet.replace(new RegExp(`\\b(${kw})\\b`, 'gi'), `<strong class="text-accent-primary">$1</strong>`);
        });

        // --- NEW: Snippet is now wrapped in an <a> tag ---
        snippetsHTML += `
            <a href="#" class="source-snippet-link block p-2 border border-border-color bg-bg-pane-dark rounded-md text-xs hover:bg-bg-pane-light" data-note-id="${item.note.id}">
                <div class="font-semibold text-text-primary mb-1 flex justify-between items-center">
                    <span>🧾 From: “${item.note.name}”</span>
                    <span class="text-xs text-white font-medium px-1.5 py-0.5 rounded-full ${relevanceClass}">${normalizedPercentage}% Relevant</span>
                </div>
                <div class="text-text-secondary italic pointer-events-none">${bestSnippet}</div>
            </a>
        `;
    });

    sourcesEl.innerHTML = snippetsHTML;
    sourcesContainer.classList.remove('hidden');
    feather.replace();
};
function parseInternalLinks(htmlContent) {
    // This check prevents the function from running if state or state.collections is missing.
    if (!htmlContent || !state || !state.collections) return htmlContent;

    const allNotes = getAllNotes(state.collections);
    return htmlContent.replace(/\[\[(.*?)\]\]/g, (match, noteName) => {
        const trimmedName = noteName.trim();
        
        // --- THIS IS THE FIX ---
        // We now trim the note name from the state data (n.name.trim()) before comparing.
        // This protects against invisible leading/trailing spaces from bad data.
        const foundNote = allNotes.find(n => n.name.trim().toLowerCase() === trimmedName.toLowerCase());
        
        if (foundNote) {
            return `<a href="#" class="internal-link" title="Link to '${foundNote.name.trim()}'" data-note-id="${foundNote.id}">${trimmedName}</a>`;
        } else {
            return `<span class="internal-link-broken" title="Note not found: '${trimmedName}'">${trimmedName}</span>`;
        }
    });
}

// --- 2. HANDLER FUNCTIONS (Higher Level) ---
// These functions use the helpers defined above.

const handleShareNote = async (noteToShare) => {
    // If a note object is passed (e.g., from a command), use it. Otherwise, find the active note.
    const noteStub = noteToShare || findItem(state.settings.activeNoteId)?.item;
    if (!noteStub) {
        showToast('❌ No note selected to share.', 'error');
        return;
    }

    // FIX: Get the full note data, including content, from the cache using the note's ID.
    const noteData = window.noteCache[noteStub.id];
    if (!noteData) {
        showToast('❌ Could not load note content to share.', 'error');
        return;
    }

    const toastId = showToast('Creating share link...', 'loading');

    try {
        const { doc, setDoc, collection } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        const publicNotesCol = collection(window.db, "publishedNotes");
        const publicNoteRef = doc(publicNotesCol);

        await setDoc(publicNoteRef, {
            name: noteData.name,         // FIX: Use name from the full cached data
            content: noteData.content,   // FIX: Use content from the full cached data
            originalAuthor: window.auth.currentUser.uid,
            sharedAt: new Date().toISOString()
        });

        const shareUrl = `${window.location.origin}${window.location.pathname}?view=${publicNoteRef.id}`;
        dismissToast(toastId);

        // This will now be called correctly.
        await showPrompt({
            title: 'Share Link Created',
            message: 'Anyone with this link can view a read-only version of this note.',
            initialValue: shareUrl,
            isReadOnly: true
        });

    } catch (error) {
        console.error("Error creating share link:", error);
        dismissToast(toastId);
        showToast('Could not create share link.', 'error');
    }
};

const handlePublicNoteView = async (noteId) => {
    // --- Initial Setup ---
    document.getElementById('theme-color-meta')?.setAttribute('content', '#100F1B');
    document.body.classList.remove('overflow-hidden');
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('auth-container').style.display = 'none';
    const publicView = document.getElementById('public-note-view');
    publicView.classList.remove('hidden');
    document.getElementById('chatbot-fab').style.display = 'none';

    try {
        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        const docRef = doc(window.db, "publishedNotes", noteId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const noteData = docSnap.data();
            document.getElementById('public-note-title').textContent = noteData.name;
            document.title = `${noteData.name} | Reputifly Notes`;

            const noteContentDiv = document.getElementById('public-note-content');
            let html = noteData.content || '';

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            
            // **THIS IS THE FIX TO REMOVE THE FILTER BAR**
            tempDiv.querySelectorAll('table').forEach(table => {
                // Find and remove the filter row, which is the first row in the table head
                const filterRow = table.querySelector('thead tr:first-child');
                if (filterRow && filterRow.querySelector('.table-filter-input')) {
                    filterRow.remove();
                }

                // Add sortable class to the actual header row
                table.querySelectorAll('thead tr th').forEach(th => {
                    th.classList.add('sortable-header');
                    th.dataset.sortDir = 'none';
                });
                
                const tbody = table.querySelector('tbody');
                if (tbody) {
                    table._originalRows = Array.from(tbody.querySelectorAll('tr'));
                }
            });
            html = tempDiv.innerHTML.replace(/ contenteditable="true"/g, '');
            // CRITICAL: Sanitize all public-facing content to prevent XSS
noteContentDiv.innerHTML = DOMPurify.sanitize(html);

            // Delegated Click Listener for Sorting and Code Copying
            noteContentDiv.addEventListener('click', (e) => {
                const header = e.target.closest('th.sortable-header');
                if (header) {
                    const table = header.closest('table');
                    const tbody = table.querySelector('tbody');
                    if (!tbody) return;
                    const rowsToSort = Array.from(tbody.querySelectorAll('tr'));
                    const headers = Array.from(header.parentElement.children);
                    const colIndex = headers.indexOf(header);
                    const currentDir = header.dataset.sortDir;
                    const newDir = currentDir === 'asc' ? 'desc' : (currentDir === 'desc' ? 'none' : 'asc');
                    headers.forEach(h => { h.dataset.sortDir = 'none'; h.querySelector('.sort-indicator')?.remove(); });

                    if (newDir === 'none') {
                        if(table._originalRows) tbody.append(...table._originalRows);
                    } else {
                        const isNumeric = rowsToSort.every(row => { const cellText = row.children[colIndex]?.innerText.trim() || ''; return cellText === '' || !isNaN(parseFloat(cellText.replace(/[^0-9.-]+/g, ""))); });
                        rowsToSort.sort((rowA, rowB) => {
                            const cellA = rowA.children[colIndex]?.innerText.trim() || '';
                            const cellB = rowB.children[colIndex]?.innerText.trim() || '';
                            if (isNumeric) { const numA = parseFloat(cellA.replace(/[^0-9.-]+/g, "")) || 0; const numB = parseFloat(cellB.replace(/[^0-9.-]+/g, "")) || 0; return newDir === 'asc' ? numA - numB : numB - numA; }
                            return newDir === 'asc' ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
                        });
                        tbody.append(...rowsToSort);
                        header.dataset.sortDir = newDir;
                        header.insertAdjacentHTML('beforeend', `<span class="sort-indicator">${newDir === 'asc' ? '▲' : '▼'}</span>`);
                    }
                    return;
                }
                const checklistItem = e.target.closest('.checklist-item');
if (checklistItem) {
    e.preventDefault();
    const checkbox = checklistItem.querySelector('.checklist-item-checkbox');
    const isCheckedNow = !checklistItem.classList.contains('checked');

    if (checkbox) {
        checkbox.checked = isCheckedNow;
    }
    checklistItem.classList.toggle('checked', isCheckedNow);
    return; // Stop further processing for this click
}
                const copyBtn = e.target.closest('.copy-code-btn');
                if (copyBtn) {
                    const codeBlock = copyBtn.closest('.code-block-wrapper')?.querySelector('pre, code');
                    if (codeBlock) { navigator.clipboard.writeText(codeBlock.innerText).then(() => showToast('Code copied!', 'success')).catch(() => showToast('Failed to copy code.', 'error')); }
                }
            });

            // Other existing listeners
            noteContentDiv.addEventListener('change', (e) => {
                if (e.target.matches('.task-list-item input[type="checkbox"]')) {
                    const item = e.target.closest('.task-list-item');
                    if (item) item.classList.toggle('checked', e.target.checked);
                }
            });
            document.getElementById('copy-note-btn').addEventListener('click', () => {
                navigator.clipboard.writeText(noteContentDiv.innerText).then(() => showToast('Note content copied!', 'success')).catch(() => showToast('Failed to copy content.', 'error'));
            });

            hljs.highlightAll();

        } else {
            document.getElementById('public-note-title').textContent = 'Note Not Found';
            document.getElementById('public-note-content').innerHTML = '<p>The link you followed may be broken or the note may have been deleted.</p>';
        }
    } catch (error) {
        console.error("Error fetching public note:", error);
        document.getElementById('public-note-title').textContent = 'Error';
        document.getElementById('public-note-content').innerHTML = '<p>Could not load the note due to an error.</p>';
    } finally {
        feather.replace();
    }
};
// --- START: NEW RESEARCH AGENT LOGIC ---
// --- START: NEW RESEARCH AGENT LOGIC ---
// Add this new function
const updateAllLinksAgent = async () => {
    const toastId = showToast('🔗 Scanning all notes for link updates...', 'loading');
    const { doc, writeBatch, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

    try {
        // Step 1: Ensure all notes are loaded into the cache
        const allNoteStubs = getAllNotes(state.collections);
        const notesToLoad = allNoteStubs.filter(stub => !window.noteCache[stub.id]);
        if (notesToLoad.length > 0) {
            const fetchPromises = notesToLoad.map(stub => getDoc(doc(db, "notes", stub.id)).then(snap => {
                if (snap.exists()) window.noteCache[stub.id] = snap.data();
            }));
            await Promise.all(fetchPromises);
        }

        const batch = writeBatch(db);
        let updatedCount = 0;
        const allNotes = Object.values(window.noteCache);
        const nameToIdMap = new Map(allNoteStubs.map(n => [n.name.toLowerCase(), n.id]));

        // Step 2: Iterate through every note and update its links
        for (const note of allNotes) {
            let contentChanged = false;
            let newContent = note.content;

            newContent = newContent.replace(/\[\[(.*?)\]\]/g, (match, noteName) => {
                const trimmedName = noteName.trim();
                const targetId = nameToIdMap.get(trimmedName.toLowerCase());
                if (targetId) {
                    return `[[${trimmedName}]]`; // Link is valid, keep it
                }
                // If link is broken, try to find note by old name (more complex) or leave as is for now.
                // This basic implementation focuses on ensuring valid links are preserved.
                return match; // For now, we leave broken links as they are.
            });
            
            // This regex is for already-parsed links (<a> tags)
            newContent = newContent.replace(/<a[^>]*class="internal-link"[^>]*data-note-id="([^"]+)"[^>]*>(.*?)<\/a>/g, (match, noteId, linkText) => {
                const targetNote = findItem(noteId)?.item;
                if (targetNote && targetNote.name !== linkText) {
                    contentChanged = true;
                    return `<a href="#" class="internal-link" title="Link to '${targetNote.name}'" data-note-id="${noteId}">${targetNote.name}</a>`;
                }
                return match; // No change needed
            });


            if (contentChanged) {
                updatedCount++;
                const noteRef = doc(db, "notes", note.id);
                batch.update(noteRef, { content: newContent });
            }
        }

        if (updatedCount > 0) {
            await batch.commit();
            dismissToast(toastId);
            showToast(`✅ Updated links in ${updatedCount} note(s).`, 'success');
        } else {
            dismissToast(toastId);
            showToast('👍 All links are already up to date.', 'info');
        }
    } catch (error) {
        console.error("Link update failed:", error);
        dismissToast(toastId);
        showToast('❌ Failed to update links.', 'error');
    }
};
const researchAgent = async (topic) => {
    const toastId = showToast(`🔬 Researching "${topic}"...`, 'loading');

    // STEP 1: FIND RELEVANT NOTE IDs
    const searchResults = lunrIndex.search(topic);
    const sourceNoteIds = searchResults.slice(0, 5).map(res => res.ref);

    if (sourceNoteIds.length === 0) {
        dismissToast(toastId);
        showToast(`No relevant notes found for "${topic}".`, 'info');
        return;
    }

    // STEP 2: ENSURE REQUIRED NOTES ARE LOADED INTO THE CACHE
    const notesToLoad = sourceNoteIds.filter(id => !window.noteCache[id]);
    if (notesToLoad.length > 0) {
        try {
            const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
            const fetchPromises = notesToLoad.map(id => {
                const noteRef = doc(db, "notes", id);
                return getDoc(noteRef).then(noteSnap => {
                    if (noteSnap.exists()) {
                        window.noteCache[id] = noteSnap.data(); // Add to cache
                    }
                });
            });
            await Promise.all(fetchPromises);
        } catch (error) {
            dismissToast(toastId);
            console.error("Error loading notes for research:", error);
            showToast("Failed to load source notes.", "error");
            return;
        }
    }

    // STEP 3: READ & PREPARE CONTEXT FROM CACHED NOTES
    const context = sourceNoteIds
        .map(id => window.noteCache[id]) // Get full note data from cache
        .filter(Boolean) // Filter out any notes that failed to load
        .map(noteData => {
            return `--- Note Source: "${noteData.name}" ---\n${(noteData.content || '').replace(/<[^>]*>?/gm, '')}`;
        }).join('\n\n');

    // STEP 4: SYNTHESIZE WITH AI
    const prompt = `You are a research assistant. Based ONLY on the provided notes, write a comprehensive research brief about "${topic}". Structure your response in well-written Markdown. At the end of your response, include a "Sources" section listing the names of the notes you used, like this:\n## Sources\n- [[Note Name 1]]\n- [[Note Name 2]]`;
    const finalPrompt = `${prompt}\n\nContext from Notes:\n${context}`;
    const payload = { contents: [{ parts: [{ text: finalPrompt }] }] };
    const aiBrief = await callGeminiAPI(payload);
    dismissToast(toastId);

    if (!aiBrief) {
        showToast('The AI could not generate a research brief.', 'error');
        return;
    }

    // STEP 5: CREATE & LINK THE NEW NOTE
    // STEP 5: CREATE & LINK THE NEW NOTE
const newNoteName = `Research Brief: ${topic}`;

// Convert markdown to HTML, then find and convert [[links]] to clickable <a> tags
// Convert markdown to HTML, then find and convert [[links]] to clickable <a> tags
const initialHtml = marked.parse(aiBrief);
const sanitizedHtml = DOMPurify.sanitize(initialHtml); // ADD THIS LINE TO SANITIZE
const finalHtmlWithLinks = parseInternalLinks(sanitizedHtml); // Process the CLEAN HTML

const newNote = await createNewNote(true, { name: newNoteName, content: finalHtmlWithLinks }, null);

    // After creation, the note is active. We need to update its links and save again.
    const activeNoteFullData = window.noteCache[newNote.id];
    if (activeNoteFullData) {
        updateNoteLinks(activeNoteFullData);
        await performImmediateSave(); // Save the link updates
    }
    
    showToast(`✅ Research brief created!`, 'success');
};
// --- START: NEW MEETING ASSISTANT LOGIC ---
const meetingAssistantAgent = async (noteId) => {
    const toastId = showToast('🤝 Processing meeting notes...', 'loading');
    const { item: note } = findItem(noteId);

    if (!note || !note.content) {
        dismissToast(toastId);
        return showToast('Note is empty.', 'info');
    }

    const plainContent = note.content.replace(/<[^>]*>?/gm, ' ').trim();

    // STEP 1: ANALYZE & EXTRACT (with a JSON-focused prompt)
    const prompt = `Analyze the following meeting minutes.
    1.  Provide a concise summary of the key decisions made.
    2.  Extract all action items and identify who is assigned to each task.
    
    Return your response as a single, valid JSON object with two keys: "summary" (a string) and "actionItems" (an array of objects, where each object has "task" and "assignee" keys).
    
    Example: {"summary": "The team decided...", "actionItems": [{"task": "Draft the report", "assignee": "Alice"}, {"task": "Update the slides", "assignee": "Bob"}]}
    
    Meeting Minutes:
    ---
    ${plainContent}`;

    const payload = { contents: [{ parts: [{ text: prompt }] }] };
    let aiResponse;
    try {
        const rawResponse = await callGeminiAPI(payload);
        // Clean up the response to ensure it's valid JSON
        const jsonString = rawResponse.match(/{[\s\S]*}/)[0];
        aiResponse = JSON.parse(jsonString);
    } catch (error) {
        dismissToast(toastId);
        console.error("Failed to parse AI response:", error);
        return showToast('AI response was not valid. Could not process meeting.', 'error');
    }
    
    if (!aiResponse || !aiResponse.summary || !aiResponse.actionItems) {
        dismissToast(toastId);
        return showToast('AI failed to extract required information.', 'error');
    }

    // STEP 2: UPDATE THE ORIGINAL NOTE
    const summaryHTML = `<h2>Meeting Summary</h2>${marked.parse(aiResponse.summary)}`;
    note.content = summaryHTML + '<hr>' + note.content;

    // STEP 3: CREATE & LINK ACTION ITEMS
    const taskLinks = [];
    const tasksFolder = getAllFolders().find(f => f.name.toLowerCase() === 'tasks');
    const parentId = tasksFolder ? tasksFolder.id : null;

    for (const item of aiResponse.actionItems) {
        // createNewNote(switchToIt, initialContent, parentId)
        const newTask = createNewNote(false, `From meeting: [[${note.name}]]`, parentId);
        newTask.name = item.task;
        
        // Add assignee as a property
        if (item.assignee) {
            newTask.properties['Assignee'] = { type: 'select', value: item.assignee, options: [{name: item.assignee}] };
        }
        taskLinks.push(`[[${newTask.name}]]`);
    }

    if (taskLinks.length > 0) {
        note.content += `<h2>Action Items</h2><ul>${taskLinks.map(link => `<li>${link}</li>`).join('')}</ul>`;
    }

    note.modifiedAt = new Date().toISOString();
    updateNoteLinks(note); // This makes all the [[links]] clickable

    dismissToast(toastId);
    saveState();
    render(); // Re-render the UI to show all the changes
    showToast('✅ Meeting processed successfully!', 'success');
};
// --- END: NEW MEETING ASSISTANT LOGIC ---
// --- END: NEW RESEARCH AGENT LOGIC ---
// ==================================================================
//  END: CORRECT FUNCTION BLOCK
// ==================================================================
            const params = new URLSearchParams(window.location.search);
    const publicNoteId = params.get('view');
    if (publicNoteId) {
        handlePublicNoteView(publicNoteId);
        return; // Stop the normal app from loading
    }
            
            // --- START: FINAL AUTHENTICATION LOGIC ---

            // Import the functions we need at the top of the module.
            const {
                createUserWithEmailAndPassword,
                signInWithEmailAndPassword,
                sendEmailVerification
            } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");

            // ADD THIS NEW LINE:
            const { doc, setDoc, getDoc, getDocFromServer, collection, query, where } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
            

            const authContainer = document.getElementById('auth-container');
            const loginForm = document.getElementById('login-form');
            const authTitle = document.getElementById('auth-title');
            const authError = document.getElementById('auth-error');
            const showSignup = document.getElementById('show-signup');
            const showLogin = document.getElementById('show-login');
            const loginTextLink = document.getElementById('login-text-link');
            const signupTextLink = document.getElementById('signup-text-link');

            // Function to toggle between login and signup views
            const setAuthView = (isLoginView) => {
                authError.textContent = '';
                if (isLoginView) {
                    authTitle.textContent = 'Login to Your Notes';
                    loginForm.dataset.authMode = 'login';
                    loginForm.querySelector('button').textContent = 'Login';
                    loginTextLink.classList.remove('hidden');
                    signupTextLink.classList.add('hidden');
                } else {
                    authTitle.textContent = 'Create an Account';
                    loginForm.dataset.authMode = 'signup';
                    loginForm.querySelector('button').textContent = 'Sign Up';
                    loginTextLink.classList.add('hidden');
                    signupTextLink.classList.remove('hidden');
                }
            };
            
            showSignup.addEventListener('click', (e) => {
                e.preventDefault();
                setAuthView(false);
            });

            showLogin.addEventListener('click', (e) => {
                e.preventDefault();
                setAuthView(true);
            });

            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                authError.textContent = '';
                const email = loginForm['login-email'].value;
                const password = loginForm['login-password'].value;
                const mode = loginForm.dataset.authMode || 'login';

                try {
                    if (mode === 'signup') {
    // Use the globally available 'window.auth'
    const userCredential = await createUserWithEmailAndPassword(window.auth, email, password);
    await sendEmailVerification(userCredential.user); // ADD THIS LINE
    console.log('Sign up successful! Verification email sent.');
} else {
                        await signInWithEmailAndPassword(window.auth, email, password);
                        console.log('Login successful!');
                    }
                } catch (error) {
                    console.error('Authentication error:', error.code, error.message);
                    // Provide a more user-friendly error message
                    switch (error.code) {
                        case 'auth/weak-password':
                            authError.textContent = 'Password should be at least 6 characters.';
                            break;
                        case 'auth/email-already-in-use':
                            authError.textContent = 'This email is already in use. Please login.';
                            break;
                        case 'auth/invalid-credential':
                             authError.textContent = 'Invalid email or password.';
                             break;
                        default:
                            authError.textContent = 'An error occurred. Please try again.';
                            break;
                    }
                }
            });

            // We need to expose the init function to the global scope so our module script can call it
            window.appInit = init;
            
            // --- END: FINAL AUTHENTICATION LOGIC ---

            const app = {
                containers: {
                    app: document.getElementById('app-container'),
                    collectionsList: document.getElementById('collections-list-container'),
                    tagList: document.getElementById('tag-list-container'),
                    kanbanBoard: document.getElementById('kanban-board'),
                    notesListContent: document.getElementById('notes-list-content'),
                    noteEditor: document.getElementById('note-editor-view'),
                    toast: document.getElementById('toast-container'),
                    mainContentArea: document.getElementById('main-content-area'),
                    searchResultsList: document.getElementById('search-results-list'),
                    mobileControlsDropdown: document.getElementById('mobile-controls-dropdown'),
                    desktopHeaderControls: document.getElementById('desktop-header-controls'),
                },
                elements: {
                    body: document.body,
                    notesListPane: document.getElementById('notes-list-pane'),
                    paneResizer: document.getElementById('pane-resizer'),
                    sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),
                    themeToggle: document.getElementById('theme-toggle'),
                    themeReputifyIcon: document.getElementById('theme-reputify-icon'),
                    themeSunIcon: document.getElementById('theme-sun-icon'),
                    themeMoonIcon: document.getElementById('theme-moon-icon'),
                    themeText: document.getElementById('theme-text'),
                    newCollectionBtn: document.getElementById('new-collection-btn'),
                    desktopNewNoteBtn: document.getElementById('desktop-new-note-btn'),
                    chatbotFab: document.getElementById('chatbot-fab'),
                    currentViewTitle: document.getElementById('current-view-title'),
                    noteEditorTitle: document.getElementById('note-editor-title'),
                    noteEditorBody: document.getElementById('note-editor-body'),
                    markdownPreview: document.getElementById('markdown-preview'),
                    wordCount: document.getElementById('word-count'),
                    charCount: document.getElementById('char-count'),
                    mobileMenuBtn: document.getElementById('mobile-menu-button'),
                    mobileSidebarOverlay: document.getElementById('mobile-sidebar-overlay'),
                    sortOrderSelect: document.getElementById('sort-order'),
                    listViewControls: document.getElementById('list-view-controls'),
                    viewSwitcher: document.getElementById('view-switcher-container'),
                    importFileInput: document.getElementById('import-file-input'),
                    mobileMoreButton: document.getElementById('mobile-more-button'),
                    headerMainContent: document.getElementById('header-main-content'),
                    toggleTagsBtn: document.getElementById('toggle-tags-btn'), // Add this line
                },
                modals: {
                    // Add these new lines for the quiz modal
quiz: document.getElementById('quiz-modal'),
quizContent: document.getElementById('quiz-content'),
quizCloseBtn: document.getElementById('quiz-close-btn'),
quizDoneBtn: document.getElementById('quiz-done-btn'),
                    backdrop: document.getElementById('modal-backdrop'),
                    apiKey: document.getElementById('api-key-modal'),
                    apiKeyInput: document.getElementById('api-key-input'),
                    apiKeyConfirmBtn: document.getElementById('api-key-confirm-btn'),
                    apiKeyError: document.getElementById('api-key-error'),
                    prompt: document.getElementById('prompt-modal'),
                    promptTitle: document.getElementById('prompt-title'),
                    promptMessage: document.getElementById('prompt-message'),
                    promptInput: document.getElementById('prompt-input'),
                    promptError: document.getElementById('prompt-error'),
                    promptConfirmBtn: document.getElementById('prompt-confirm-btn'),
                    promptCancelBtn: document.getElementById('prompt-cancel-btn'),
                    confirm: document.getElementById('confirm-modal'),
                    confirmTitle: document.getElementById('confirm-title'),
                    confirmMessage: document.getElementById('confirm-message'),
                    confirmConfirmBtn: document.getElementById('confirm-confirm-btn'),
                    confirmCancelBtn: document.getElementById('confirm-cancel-btn'),
                    bookmarklet: document.getElementById('bookmarklet-modal'),
                    bookmarkletLink: document.getElementById('bookmarklet-link'),
                    bookmarkletCloseBtn: document.getElementById('bookmarklet-close-btn'),
                    graph: document.getElementById('graph-modal'),
                    graphContainer: document.getElementById('graph-container'),
                    graphCloseBtn: document.getElementById('graph-close-btn'),
                    aiPrompt: document.getElementById('ai-prompt-modal'),
                    aiPromptInput: document.getElementById('ai-prompt-input'),
                    aiPromptError: document.getElementById('ai-prompt-error'),
                    aiGenerateBtn: document.getElementById('ai-generate-btn'),
                    aiCancelBtn: document.getElementById('ai-cancel-btn'),
                    aiGenerateBtnText: document.getElementById('ai-generate-btn-text'),
                    summary: document.getElementById('summary-modal'),
                    summaryContent: document.getElementById('summary-content'),
                    summaryCloseBtn: document.getElementById('summary-close-btn'),
                    chatbot: document.getElementById('chatbot-modal'),
                    chatbotHistory: document.getElementById('chatbot-history'),
                    chatbotInput: document.getElementById('chatbot-input'),
                    chatbotSendBtn: document.getElementById('chatbot-send-btn'),
                    chatbotCloseBtn: document.getElementById('chatbot-close-btn'),
                    chatbotClearBtn: document.getElementById('chatbot-clear-btn'),
                    chatbotError: document.getElementById('chatbot-error'),
                },
                search: {
                    icon: document.getElementById('header-search-icon'),
                    mobileIcon: document.getElementById('mobile-search-icon'),
                    container: document.getElementById('search-bar-container'),
                    input: document.getElementById('search-input'),
                    closeBtn: document.getElementById('search-close-btn'),
                },
                toolbar: {
                    inline: document.getElementById('inline-toolbar'),
                    editorModeToggle: document.getElementById('editor-mode-toggle'),
                    ocrBtn: document.querySelector('[data-command="ocr"]'),
                    ocrFileInput: document.getElementById('ocr-file-input'),
                    dictateBtn: document.getElementById('dictate-btn'),
                    graphBtn: document.getElementById('graph-btn'),
                },
                views: {
                    board: document.getElementById('board-view'),
                    list: document.getElementById('list-view'),
                    searchResults: document.getElementById('search-results-view'),
                },
                contextMenu: {
                    menu: document.getElementById('context-menu'),
                    targetId: null,
                    targetIsContainer: false,
                    pinActionText: document.getElementById('pin-action-text'),
                    togglePinBtn: document.querySelector('[data-action="toggle-pin"]'),
                    renameBtn: document.querySelector('[data-action="rename"]'),
                    deleteBtn: document.querySelector('[data-action="delete"]'),
                    duplicateBtn: document.querySelector('[data-action="duplicate"]'),
                }
            };

            let state = {};
            let isNoteDirty = false; // Tracks if the current note has unsaved changes
let activeNoteCleanCopy = ''; // Stores the last saved version of the content
            let isSearchActive = false;
            let editorSelectionRange = null;
            let speechRecognizer = null;
            let isDictating = false;
            let saveNoteContent;
            let performImmediateSave;
            const restoreSelectionAndExec = (execFn) => {
                        app.elements.noteEditorBody.focus();
                        if (editorSelectionRange) {
                            const selection = window.getSelection();
                            selection.removeAllRanges();
                            selection.addRange(editorSelectionRange);
                        }
                        execFn();
                        saveNoteContent();
                        if (window.getSelection().rangeCount > 0) {
                           editorSelectionRange = window.getSelection().getRangeAt(0).cloneRange();
                        }
                    };
            let lunrIndex;
            let hasInitialized = false;
            let isExecutingCommand = false; // ADD THIS LINE
            let activeNoteListener = null; // Unsubscribe function for the real-time listener
            
            const headingNavPill = document.getElementById('heading-nav-pill');
const headingNavDots = document.getElementById('heading-nav-dots');
const headingNavTooltipContent = document.getElementById('heading-nav-tooltip-content');
let headingObserver = null;
let mutationObserver = null;
window.noteCache = {}; // Global cache for all note contents
const listenToActiveNote = () => {
    if (activeNoteListener) {
        activeNoteListener();
        activeNoteListener = null;
    }

    const noteId = state.settings.activeNoteId;
    if (!noteId) return;

    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js").then(({ doc, onSnapshot }) => {
        const noteRef = doc(db, "notes", noteId);

        activeNoteListener = onSnapshot(noteRef, (docSnap) => {
            if (docSnap.metadata.hasPendingWrites) {
                return;
            }

            if (docSnap.exists()) {
                const serverNoteData = docSnap.data();
                window.noteCache[noteId] = serverNoteData; 

                // Find the sidebar data and update its name if it changed.
                const noteStub = findItem(noteId)?.item;
                if (noteStub && noteStub.name !== serverNoteData.name) {
                    noteStub.name = serverNoteData.name;
                    // Re-render the sidebar to show the new name.
                    renderCollectionsList();
                }

                // Update the main editor view if it's the active note.
                if (noteId === state.settings.activeNoteId) {
                    const editorTitle = app.elements.noteEditorTitle;
                    const editorBody = app.elements.noteEditorBody;

                    if (editorTitle.value !== serverNoteData.name) {
                        editorTitle.value = serverNoteData.name;
                    }
                    if (editorBody.innerHTML !== serverNoteData.content) {
                        editorBody.innerHTML = serverNoteData.content;
                        updateEditorStats();
                        feather.replace();
                    }
                }
            } else {
                if (activeNoteListener) activeNoteListener();
                state.settings.activeNoteId = null;
                showToast("This note has been deleted.", "info");
                render();
            }
        }, (error) => {
            console.error("Error listening to note:", error);
            showToast("Connection to note lost.", "error");
        });
    });
};

            let askYourNotesHistory = [];
            const showToast = (message, type = 'info') => {
                const id = generateId('toast');
                const toast = document.createElement('div');
                const colors = {
                    info: 'bg-bg-pane-dark text-text-primary',
                    success: 'bg-green-500 text-white',
                    error: 'bg-red-500 text-white',
                    loading: 'bg-blue-500 text-white animate-pulse'
                }
                toast.id = id;
                toast.className = `toast-item ${colors[type]} rounded-full px-4 py-2 text-sm shadow-lg transition-all duration-300 transform translate-y-[-20px] opacity-0`;
                toast.textContent = message;
                
                app.containers.toast.appendChild(toast);
                app.containers.toast.style.pointerEvents = 'auto';

                setTimeout(() => {
                    toast.classList.remove('translate-y-[-20px]', 'opacity-0');
                }, 10);
                
                if (type !== 'loading') {
                    setTimeout(() => {
                        toast.classList.add('opacity-0', 'scale-90');
                        toast.addEventListener('transitionend', () => {
                             if(toast.parentElement) toast.parentElement.removeChild(toast);
                             if (app.containers.toast.childElementCount === 0) {
                                app.containers.toast.style.pointerEvents = 'none';
                             }
                        });
                    }, 3000);
                }
                return id;
            };
            
            const dismissToast = (toastId) => {
                const toast = document.getElementById(toastId);
                if (toast) {
                    toast.classList.add('opacity-0', 'scale-90');
                    toast.addEventListener('transitionend', () => {
                         if(toast.parentElement) toast.parentElement.removeChild(toast);
                         if (app.containers.toast.childElementCount === 0) {
                            app.containers.toast.style.pointerEvents = 'none';
                         }
                    });
                }
            };
            function saveCurrentNoteImmediately() {
    if (!state.settings.activeNoteId) return;
    const findResult = findItem(state.settings.activeNoteId);
    if (findResult && findResult.item) {
        const note = findResult.item;
        const newName = app.elements.noteEditorTitle.value;
        const newContent = app.elements.noteEditorBody.innerHTML;

        // Update the state object in memory right away
        note.name = newName;
        note.content = newContent;
        note.modifiedAt = new Date().toISOString();
        updateNoteLinks(note);
        updateNoteTags(note);

        // Trigger the async save to the database
        saveState();

        // Update the UI
        buildLunrIndex();
        renderCollectionsList();
    }
}
            // --- START: In-Note Search Logic ---
            // Add this new function
function closeAndClearSearch() {
    const editorBody = app.elements.noteEditorBody;
    const highlightControls = document.getElementById('highlight-controls');

    if (highlightControls) {
        highlightControls.classList.add('hidden');
    }

    clearInNoteHighlights();
    const inNoteInput = document.getElementById('in-note-search-input');
    if (inNoteInput) {
        inNoteInput.value = '';
    }
    updateInNoteUI();

    const marks = Array.from(editorBody.querySelectorAll('mark:not(.in-note-highlight)'));

    if (marks.length > 0) {
        marks.forEach(mark => {
            const parent = mark.parentNode;
            while (mark.firstChild) {
                parent.insertBefore(mark.firstChild, mark);
            }
            parent.removeChild(mark);
            parent.normalize();
        });
    }

    // This is the key: Instantly update the note's content in the state 
    // and trigger the database save, fixing the refresh bug.
    saveCurrentNoteImmediately();
}
let inNoteMatches = [];
let inNoteCurrentIndex = -1;

function clearInNoteHighlights() {
    const editorBody = app.elements.noteEditorBody;
    const marks = Array.from(editorBody.querySelectorAll('mark.in-note-highlight'));
    marks.forEach(mark => {
        const parent = mark.parentNode;
        parent.replaceChild(document.createTextNode(mark.textContent), mark);
        parent.normalize(); // Merges adjacent text nodes
    });
    inNoteMatches = [];
    inNoteCurrentIndex = -1;
}

function updateInNoteUI() {
    const countEl = document.getElementById('in-note-search-count');
    const nextBtn = document.getElementById('in-note-search-next');
    const prevBtn = document.getElementById('in-note-search-prev');

    if (inNoteMatches.length === 0) {
        countEl.textContent = 'No results';
        nextBtn.disabled = true;
        prevBtn.disabled = true;
    } else {
        countEl.textContent = `${inNoteCurrentIndex + 1} of ${inNoteMatches.length}`;
        nextBtn.disabled = inNoteCurrentIndex >= inNoteMatches.length - 1;
        prevBtn.disabled = inNoteCurrentIndex <= 0;
    }
}

function navigateToMatch(index) {
    if (inNoteMatches[inNoteCurrentIndex]) {
        inNoteMatches[inNoteCurrentIndex].classList.remove('current');
    }
    inNoteCurrentIndex = index;
    const currentMatch = inNoteMatches[inNoteCurrentIndex];
    currentMatch.classList.add('current');

    // --- ROBUST SCROLL LOGIC TO PREVENT CUT-OFF HEADER ---
    // This is the new, more reliable scrolling logic.
// This new logic correctly calculates scroll position, accounting for the header
            const mainContentArea = document.getElementById('main-content-area');
            const header = document.getElementById('highlight-controls');
            const headerHeight = header.offsetHeight;
            const elementRect = currentMatch.getBoundingClientRect();
            const containerRect = mainContentArea.getBoundingClientRect();
            const scrollTop = mainContentArea.scrollTop;
            const desiredPadding = 20; // A little space between the header and the highlight

            const elementTopRelativeToContainer = elementRect.top - containerRect.top;
            const targetScrollTop = scrollTop + elementTopRelativeToContainer - headerHeight - desiredPadding;

            mainContentArea.scrollTo({
                top: targetScrollTop,
                behavior: 'smooth'
            });
    // --- END OF NEW LOGIC ---

    updateInNoteUI();
}

function performInNoteSearch() {
    clearInNoteHighlights();
    const query = document.getElementById('in-note-search-input').value;
    if (!query) {
        updateInNoteUI();
        return;
    }

    const editorBody = app.elements.noteEditorBody;
    const regex = new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');

    const walker = document.createTreeWalker(editorBody, NodeFilter.SHOW_TEXT, null, false);
    let node;
    const nodesToReplace = [];
    while (node = walker.nextNode()) {
        if (node.parentElement.tagName !== 'SCRIPT' && node.parentElement.tagName !== 'STYLE' && regex.test(node.textContent)) {
            nodesToReplace.push(node);
        }
    }

    nodesToReplace.forEach(node => {
        const newHtml = node.textContent.replace(regex, `<mark class="in-note-highlight">$1</mark>`);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newHtml;
        // Make checklist widget interactive on public page
tempDiv.querySelectorAll('.checklist-container').forEach(el => el.removeAttribute('contenteditable'));
tempDiv.querySelectorAll('.checklist-item-checkbox').forEach(cb => cb.removeAttribute('onclick'));
        const parent = node.parentNode;
        while(tempDiv.firstChild) {
            parent.insertBefore(tempDiv.firstChild, node);
        }
        parent.removeChild(node);
    });

    inNoteMatches = Array.from(editorBody.querySelectorAll('mark.in-note-highlight'));
    if (inNoteMatches.length > 0) {
        navigateToMatch(0);
    } else {
        updateInNoteUI();
    }
}

function setupInNoteSearchListeners() {
    const searchInput = document.getElementById('in-note-search-input');
    document.getElementById('clear-search-btn').addEventListener('click', closeAndClearSearch);

    document.getElementById('in-note-search-next').addEventListener('click', () => {
        if (inNoteCurrentIndex < inNoteMatches.length - 1) {
            navigateToMatch(inNoteCurrentIndex + 1);
        }
    });

    document.getElementById('in-note-search-prev').addEventListener('click', () => {
        if (inNoteCurrentIndex > 0) {
            navigateToMatch(inNoteCurrentIndex - 1);
        }
    });

    searchInput.addEventListener('input', performInNoteSearch);
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if(e.shiftKey) {
                document.getElementById('in-note-search-prev').click();
            } else {
                document.getElementById('in-note-search-next').click();
            }
        }
        if (e.key === 'Escape') {
             // Use the correct button ID for the smart bar's 'X'
             document.getElementById('clear-search-btn').click();
        }
    });
}
// --- END: In-Note Search Logic ---

            // REPLACE THE OLD OBJECT WITH THIS NEW ONE
const defaultState = {
    collections: [
        {
            id: 'c1', 
            name: 'My First Project', 
            type: 'folder', 
            children: [], // The notes have been removed from here
            expanded: true
        }
    ],
    settings: {
        theme: 'reputify',
        activeCollectionId: null, // No active collection by default
        activeNoteId: null,       // No active note by default
        paneWidth: 280,
        sidebarCollapsed: false,
        activeView: 'list',
        listSortOrder: 'modifiedAt-desc',
        editorMode: 'editor',
        activeTag: null,
        tagsCollapsed: false,
        backlinksCollapsed: false,
        chatbotVisible: true,
        propertiesVisible: true,
        
    },
    templates: [],
    agents: [],    // <-- Add this new line
    versions: {},  // <-- This line is next
    kanbanColumns: {
        'c1': [{ id: 'col1', title: 'To Do' }, { id: 'col2', title: 'In Progress' }, { id: 'col3', title: 'Done' }]
    },
    chatHistory: []
};

            async function saveState() {
    const user = window.auth.currentUser;
    if (!user) return;

    try {
        const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        const userDocRef = doc(window.db, "users", user.uid, "data", "appState");

        // Create a clean copy of the state for saving.
        // We DELETE the 'versions' property because it's now stored elsewhere.
        const stateToSave = { ...state };
        delete stateToSave.versions;

        await setDoc(userDocRef, stateToSave);

    } catch (error) {
        console.error("Failed to save app state to Firestore:", error);
        showToast("Error saving workspace to the cloud.", 'error');
    }
}
            function renderTagsState() {
    const isCollapsed = state.settings.tagsCollapsed;
    app.elements.toggleTagsBtn.classList.toggle('collapsed', isCollapsed);
    app.containers.tagList.classList.toggle('collapsed', isCollapsed);
}
            function migrateState(loadedState) {
    const migrateNode = (node, parentFolder = null) => {
        if (node.type === 'note') {
            if (typeof node.pinned === 'undefined') node.pinned = false;
            if (!Array.isArray(node.links)) node.links = [];
            if (!Array.isArray(node.tags)) node.tags = [];
            const now = new Date().toISOString();
            if (typeof node.createdAt === 'undefined') node.createdAt = now;
            if (typeof node.modifiedAt === 'undefined') node.modifiedAt = node.createdAt;
            if (typeof node.properties === 'undefined') node.properties = {};
            if (typeof node.propertiesCollapsed === 'undefined') node.propertiesCollapsed = false;
            if (typeof node.isAiGenerated === 'undefined') node.isAiGenerated = false;

            // --- THIS IS THE NEW MIGRATION LOGIC ---
            // If an old note is missing a status, assign it a default one.
            if (typeof node.status === 'undefined') {
                if (parentFolder && loadedState.kanbanColumns[parentFolder.id] && loadedState.kanbanColumns[parentFolder.id][0]) {
                    node.status = loadedState.kanbanColumns[parentFolder.id][0].id;
                } else {
                    node.status = null;
                }
            }
            // --- END OF NEW LOGIC ---
        }
        if (node.children) {
            if (Array.isArray(node.children)) {
                // Pass the current folder as the parent for its children
                node.children.forEach(child => migrateNode(child, node));
            } else {
                node.children = [];
            }
        }
    };

    if (!loadedState) loadedState = {};
    if (!loadedState.settings) loadedState.settings = {};
    if (typeof loadedState.settings.backlinksCollapsed === 'undefined') loadedState.settings.backlinksCollapsed = false;
    if (typeof loadedState.settings.chatbotVisible === 'undefined') loadedState.settings.chatbotVisible = true;
    if (typeof loadedState.settings.propertiesVisible === 'undefined') loadedState.settings.propertiesVisible = true;
    if (!Array.isArray(loadedState.collections)) loadedState.collections = [];
    if (!loadedState.kanbanColumns) loadedState.kanbanColumns = {};
    if (!Array.isArray(loadedState.chatHistory)) loadedState.chatHistory = [];
    if (!Array.isArray(loadedState.templates)) loadedState.templates = [];
    
    if (!Array.isArray(loadedState.agents)) loadedState.agents = []; // <-- THIS IS THE FIX

    // This initial call passes `null` as the parent for top-level items
    loadedState.collections.forEach(node => migrateNode(node, null));

    if (typeof loadedState.settings.sidebarCollapsed === 'undefined') loadedState.settings.sidebarCollapsed = false;
    if (typeof loadedState.settings.paneWidth === 'undefined') loadedState.settings.paneWidth = 280;
    if (typeof loadedState.settings.activeTag === 'undefined') loadedState.settings.activeTag = null;
    if (typeof loadedState.settings.tagsCollapsed === 'undefined') loadedState.settings.tagsCollapsed = false;
    if (!loadedState.settings.listSortOrder) loadedState.settings.listSortOrder = 'modifiedAt-desc';
    if (!loadedState.settings.editorMode) loadedState.settings.editorMode = 'editor';

    return loadedState;
}

            // REPLACE the old loadState function with this one.


// START: REPLACEMENT loadState FUNCTION (Lazy Loading)
// =================================================================
// notetakeapp.html

// =================================================================
// START: REPLACEMENT loadState FUNCTION (Lazy Loading)
// =================================================================
async function loadState() {
    const user = window.auth.currentUser;
    if (!user) return;

    const toastId = showToast('Loading workspace...', 'loading');
    
    try {
        // CORRECTED: Added getDocs, query, where, and setDoc to the import
        const { getDoc, getDocs, collection, query, where, setDoc, doc: createDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

        // 1. Initialize an empty note cache
        window.noteCache = {};

        // 2. Pre-fetch data for all notes shared with the user and populate the cache
        // This ensures the sidebar can correctly identify shared notes on first render.
        const sharedNotesQuery = query(collection(db, "notes"), where("sharedWith", "array-contains", user.uid));
        const sharedNotesSnap = await getDocs(sharedNotesQuery);
        sharedNotesSnap.forEach(doc => {
            window.noteCache[doc.id] = doc.data();
        });

        // 3. Load the user's main state (folder structure, settings, etc.)
        const userDocRef = createDoc(window.db, "users", user.uid, "data", "appState");
        const userSettingsSnap = await getDoc(userDocRef);
        let settingsAndFolders;

        if (userSettingsSnap.exists()) {
            settingsAndFolders = userSettingsSnap.data();
        } else {
            console.log("New user detected, creating default state.");
            settingsAndFolders = JSON.parse(JSON.stringify(defaultState));
            await setDoc(userDocRef, settingsAndFolders);
        }
        
        // 4. Migrate the state (this remains unchanged)
        state = migrateState(settingsAndFolders);

    } catch (error) {
        console.error("Failed to load state from Firestore:", error);
        if (!state || Object.keys(state).length === 0) {
             state = migrateState(JSON.parse(JSON.stringify(defaultState)));
        }
        showToast("Offline: Could not sync with cloud.", 'error');
    } finally {
        dismissToast(toastId);
        state.settings.theme = localStorage.getItem('codex-notes-theme') || 'reputify';
    }
}
// =================================================================
// END: REPLACEMENT loadState FUNCTION
// =================================================================
// =================================================================
// END: REPLACEMENT loadState FUNCTION
// =================================================================
// =================================================================
// END: FINAL REPLACEMENT loadState FUNCTION
// =================================================================
// =================================================================
// END: FINAL REPLACEMENT loadState FUNCTION
// =================================================================
// =================================================================
// END: FINAL REPLACEMENT loadState FUNCTION
// =================================================================

            const generateId = (prefix = 'id') => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
// ADD THIS ENTIRE FUNCTION
async function ensureAllNotesLoaded() {
    const noteIdsToLoad = window.chatbotContextNoteIds.filter(id => !window.noteCache[id]);
    if (noteIdsToLoad.length === 0) {
        return true; // All required notes are already in the cache.
    }

    const toastId = showToast(`Loading ${noteIdsToLoad.length} context note(s)...`, 'loading');

    try {
        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        
        const fetchPromises = noteIdsToLoad.map(id => {
            const noteRef = doc(db, "notes", id);
            return getDoc(noteRef).then(noteSnap => {
                if (noteSnap.exists()) {
                    window.noteCache[id] = noteSnap.data(); // Add the loaded note to the cache.
                } else {
                    console.warn(`Context note with ID ${id} not found.`);
                    // Remove missing note from context to prevent future errors
                    window.chatbotContextNoteIds = window.chatbotContextNoteIds.filter(noteId => noteId !== id);
                }
            });
        });

        await Promise.all(fetchPromises);
        dismissToast(toastId);
        renderContextPills(); // Re-render pills in case a note was removed
        return true;

    } catch (error) {
        console.error("Error loading context notes:", error);
        dismissToast(toastId);
        showToast("Failed to load context notes for the chat.", "error");
        return false;
    }
}
// REPLACE THE ENTIRE 'handleFileUpload' FUNCTION WITH THIS ONE
const handleFileUpload = async (file) => {
    const user = window.auth.currentUser;
    if (!file || !user) return;
    const spreadsheetTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    if (spreadsheetTypes.includes(file.type)) {
        handleSpreadsheetUpload(file);
        return;
    }

    const OVERALL_MAX_SIZE = 5 * 1024 * 1024; // 5 MB
    let fileToUpload = file;

    if (file.type.startsWith('image/')) {
        const localToast = showToast(`Optimizing ${file.name}...`, 'loading');
        try {
            const options = {
                maxWidthOrHeight: 1920,
                initialQuality: 0.8,
                fileType: 'image/webp',
                useWebWorker: true,
            };
            fileToUpload = await imageCompression(file, options);
            dismissToast(localToast);
        } catch (error) {
            dismissToast(localToast);
            console.error('Local compression failed.', error);
        }
    }

    if (fileToUpload.size > OVERALL_MAX_SIZE) {
        showToast(`File is too large (${(fileToUpload.size / 1024 / 1024).toFixed(2)} MB). Max size is 5MB.`, 'error');
        return;
    }

    const uploadToastId = showToast(`Uploading ${fileToUpload.name}... 0%`, 'loading');
    try {
        const { getStorage, ref, uploadBytesResumable, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js");
        const storage = getStorage();
        const storageRef = ref(storage, `users/${user.uid}/${Date.now()}-${fileToUpload.name}`);
        const uploadTask = uploadBytesResumable(storageRef, fileToUpload);

        const downloadURL = await new Promise((resolve, reject) => {
            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    const toastElement = document.getElementById(uploadToastId);
                    if (toastElement) toastElement.textContent = `Uploading ${fileToUpload.name}... ${Math.round(progress)}%`;
                },
                (error) => reject(error),
                async () => {
                    const url = await getDownloadURL(uploadTask.snapshot.ref);
                    resolve(url);
                }
            );
        });

        dismissToast(uploadToastId);
        showToast('Upload complete!', 'success');

        const escapedFileName = fileToUpload.name.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        let fileHTML = '';

        // --- START: NEW AND IMPROVED LOGIC ---
        if (fileToUpload.type.startsWith('image/')) {
            fileHTML = `<p><img src="${downloadURL}" alt="${escapedFileName}" style="max-width: 100%; height: auto; border-radius: 8px;" contenteditable="false" /></p>`;
        } else {
            // Intelligently choose an icon based on file extension
            let iconName = 'file'; // Default icon
            const extension = escapedFileName.split('.').pop().toLowerCase();
            if (['zip', 'rar', '7z'].includes(extension)) {
                iconName = 'archive';
            } else if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(extension)) {
                iconName = 'file-text';
            }

            // Create the full attachment widget with a delete button
            fileHTML = `<div class="file-attachment-widget" contenteditable="false">
                            <button class="attachment-delete-btn" title="Remove Attachment">
                                <i data-feather="x" class="w-4 h-4 pointer-events-none"></i>
                            </button>
                            <i data-feather="${iconName}" class="w-6 h-6 text-text-secondary flex-shrink-0"></i>
                            <div class="file-info">
                                <div class="file-name">${escapedFileName}</div>
                                <div class="file-size">${formatBytes(fileToUpload.size)}</div>
                            </div>
                            <a href="${downloadURL}" target="_blank" class="download-btn" download title="Download ${escapedFileName}">
                                <i data-feather="download" class="w-4 h-4"></i> Download
                            </a>
                        </div>`;
        }
        // --- END: NEW AND IMPROVED LOGIC ---

        app.elements.noteEditorBody.focus();
        document.execCommand('insertHTML', false, fileHTML + "<p><br></p>");
        feather.replace();
        saveNoteContent();

    } catch (error) {
        dismissToast(uploadToastId);
        showToast(`Upload failed: ${error.code || error.message}`, 'error');
        return;
    }
};
            
            
const saveSpecificNoteToFirestore = async (noteId, noteData) => {
    const user = window.auth.currentUser;
    if (!user) throw new Error("User not authenticated.");

    try {
        if (user.uid === noteData.ownerId) {
            const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
            const noteRef = doc(db, "notes", noteId);
            await updateDoc(noteRef, noteData);
        } else {
            const { httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
            const updateNote = httpsCallable(window.functions, 'updateNoteAsCollaborator');
            await updateNote({
                noteId: noteId,
                newName: noteData.name,
                newContent: noteData.content,
                newExcerpt: noteData.excerpt,
                newLinks: noteData.links,
                newTags: noteData.tags,
                modifiedAt: noteData.modifiedAt
            });
        }
        return true;
    } catch (error) {
        console.error(`Failed to save note ${noteId} specifically:`, error);
        throw new Error(`Database error while saving note ${noteId}.`);
    }
};
const migrateVersionsToFirestore = async () => {
    // Check if migration has already been done or is not needed.
    if (state.settings.versionsMigrated || !state.versions || Object.keys(state.versions).length === 0) {
        return;
    }

    const toastId = showToast('🚀 Upgrading your data structure...', 'loading');
    try {
        const { doc, collection, writeBatch } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        const batch = writeBatch(db);

        // Loop through each note that has old version data.
        for (const noteId in state.versions) {
        // This safety check prevents errors from orphaned version data.
    if (!findItem(noteId)) {
        console.warn(`Skipping migration for orphaned data from deleted note: ${noteId}`);
        continue; // Skip to the next item in the loop
    }
            const versionsArray = state.versions[noteId];
            if (Array.isArray(versionsArray)) {
                // For each version in the array, create a new document in the subcollection.
                versionsArray.forEach(version => {
                    const newVersionRef = doc(collection(db, "notes", noteId, "versions"));
                    batch.set(newVersionRef, {
                        content: version.content,
                        message: version.message,
                        savedAt: new Date(version.savedAt) // Ensure it's a proper timestamp
                    });
                });
            }
        }

        // After setting up all the writes, commit them at once.
        await batch.commit();

        // Mark the migration as complete and save the main state.
        state.settings.versionsMigrated = true;
        delete state.versions; // The old version data is no longer needed in the main state.
        await saveState();

        dismissToast(toastId);
        showToast('✅ Data upgrade complete!', 'success');
    } catch (error) {
        dismissToast(toastId);
        console.error("Version migration failed:", error);
        showToast("❌ Could not upgrade version history data.", "error");
    }
};
            const debounce = (func, delay) => {
                let timeout;
                return (...args) => {
                    clearTimeout(timeout);
                    timeout = setTimeout(() => func.apply(this, args), delay);
                };
            };
            const scheduleRebuildIndex = debounce(buildLunrIndex, 2000);
            const updateStatsDebounced = debounce(updateEditorStats, 500);
            
            
            
            const formatDateTime = (isoString) => {
                 return new Date(isoString).toLocaleString(undefined, {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: 'numeric', minute: '2-digit', hour12: true
                 }).replace(/, /g, ', ');
            };
            // ADD THIS NEW HELPER FUNCTION
            // ADD THIS NEW HELPER FUNCTION
function parseDurationToMinutes(str) {
    if (!str) return 0;
    str = str.toLowerCase().trim();
    let totalMinutes = 0;
    const hourMatch = str.match(/(\d*\.?\d+)\s*h/);
    const minMatch = str.match(/(\d+)\s*m/);
    if (hourMatch) totalMinutes += parseFloat(hourMatch[1]) * 60;
    if (minMatch) totalMinutes += parseInt(minMatch[1], 10);
    // If just a number is entered, assume it's minutes
    if (!hourMatch && !minMatch && !isNaN(parseFloat(str))) {
        totalMinutes = parseFloat(str);
    }
    return Math.round(totalMinutes);
}
// ADD THIS NEW HELPER FUNCTION
function updateNowIndicator() {
    let indicator = document.getElementById('now-indicator');
    if (!indicator) return;
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const top = (minutes / 60) * 48; // 48px per hour
    indicator.style.top = `${top}px`;
}
function getSelectColor(optionName) {
    const colors = ['bg-blue-500/20 text-blue-400', 'bg-green-500/20 text-green-400', 'bg-yellow-500/20 text-yellow-400', 'bg-red-500/20 text-red-400', 'bg-purple-500/20 text-purple-400', 'bg-pink-500/20 text-pink-400'];
    let hash = 0;
    for (let i = 0; i < optionName.length; i++) {
        hash = optionName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash % colors.length)];
}
            
            async function callGeminiAPI(payload, elementForError) {
                // Clear any previous errors
                if (elementForError) elementForError.textContent = '';

                try {
                    // Create a reference to our deployed Cloud Function
                    const { httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
                    const callGeminiFunction = httpsCallable(window.functions, 'callGemini');
                    
                    // Call the function with our prompt.
                    // The Firebase SDK automatically handles sending the user's auth token.
                    const response = await callGeminiFunction({ prompt: payload.contents[0].parts[0].text });

                    // The actual result from our function is in response.data.result
                    const generatedText = response.data.result;

                    if (!generatedText) {
                        throw new Error('Cloud function returned an empty response.');
                    }
                    return generatedText;

                } catch (err) {
                    console.error("Error calling Cloud Function:", err);
                    const errorMsg = `AI Error: ${err.message}`;
                    if (elementForError) elementForError.textContent = errorMsg;
                    else showToast(errorMsg, 'error');
                    return null;
                }
            }

            const openModal = (modal, isBlocking = false) => {
    const backdrop = app.modals.backdrop;
    
    // Reset transform style before opening to ensure it's always centered initially
    modal.style.transform = 'translate(-50%, -50%) scale(0.95)';
    modal.style.left = '50%';
    modal.style.top = '50%';
    
    if (isBlocking) {
        backdrop.classList.add('bg-black/50');
        backdrop.classList.remove('bg-black/30');
    } else {
        backdrop.classList.add('bg-black/30');
        backdrop.classList.remove('bg-black/50');
    }
    backdrop.style.opacity = '1';
    modal.classList.remove('hidden');
    setTimeout(() => {
        // Only remove scale and opacity, keep the centered translate
        modal.style.transform = 'translate(-50%, -50%) scale(1)';
        modal.classList.remove('opacity-0');
    }, 10);
};

            const closeModal = (modal) => {
    return new Promise(resolve => {
        const backdrop = app.modals.backdrop;
        backdrop.style.opacity = '0';
        backdrop.style.pointerEvents = 'none';

        modal.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            resolve(); // Resolve the promise after the animation is done
        }, 300);
    });
};

            const showPrompt = ({ title, message, initialValue = '', placeholder = '', isReadOnly = false }) => {
    return new Promise((resolve) => {
        const oldConfirmBtn = app.modals.promptConfirmBtn;
        const newConfirmBtn = oldConfirmBtn.cloneNode(true);
        oldConfirmBtn.parentNode.replaceChild(newConfirmBtn, oldConfirmBtn);
        app.modals.promptConfirmBtn = newConfirmBtn;

        const oldCancelBtn = app.modals.promptCancelBtn;
        const newCancelBtn = oldCancelBtn.cloneNode(true);
        oldCancelBtn.parentNode.replaceChild(newCancelBtn, oldCancelBtn);
        app.modals.promptCancelBtn = newCancelBtn;

        app.modals.promptTitle.textContent = title;
        app.modals.promptMessage.textContent = message;
        app.modals.promptInput.value = initialValue;
        app.modals.promptInput.placeholder = placeholder;
        app.modals.promptInput.readOnly = isReadOnly;
        app.modals.promptError.textContent = '';

        app.modals.promptConfirmBtn.textContent = isReadOnly ? 'Copy Link' : 'Confirm';

        openModal(app.modals.prompt);
        app.modals.promptInput.focus();
        app.modals.promptInput.select();

        const cleanup = async (value) => {
            await closeModal(app.modals.prompt); // Await the closing animation
            resolve(value);
        };

        const confirmHandler = () => {
            if (isReadOnly) {
                navigator.clipboard.writeText(app.modals.promptInput.value)
                    .then(() => showToast('Link copied!', 'success'))
                    .catch(() => showToast('Failed to copy.', 'error'));
                cleanup(null);
            } else {
                const value = app.modals.promptInput.value.trim();
                if (value) {
                    cleanup(value);
                } else {
                    app.modals.promptError.textContent = 'Input cannot be empty.';
                }
            }
        };

        newConfirmBtn.addEventListener('click', confirmHandler);
        newCancelBtn.addEventListener('click', () => cleanup(null));

        app.modals.promptInput.onkeydown = (e) => {
            if (e.key === 'Enter') { e.preventDefault(); newConfirmBtn.click(); } 
            else if (e.key === 'Escape') { newCancelBtn.click(); }
        };
    });
};
            
            const showConfirm = ({ title, message, confirmText = 'Confirm', confirmClass = 'bg-red-600' }) => {
     return new Promise((resolve) => {
        app.modals.confirmTitle.textContent = title;
        app.modals.confirmMessage.innerHTML = message;
        app.modals.confirmConfirmBtn.textContent = confirmText;
        
        app.modals.confirmConfirmBtn.className = "px-4 py-2 rounded-md text-white hover:opacity-90";
        if (state.settings.theme === 'reputify' && confirmClass.includes('red')) {
            app.modals.confirmConfirmBtn.classList.add('bg-red-600');
        } else {
            app.modals.confirmConfirmBtn.classList.add('brand-button');
        }

        openModal(app.modals.confirm);
        app.modals.backdrop.style.pointerEvents = 'auto'; // <-- ADD THIS LINE

        const confirmHandler = () => { cleanup(); resolve(true); };
        const cancelHandler = () => { cleanup(); resolve(false); };
        const backdropHandler = () => cancelHandler();

        const cleanup = () => {
            app.modals.backdrop.style.pointerEvents = 'none'; // <-- ADD THIS LINE
            app.modals.confirmConfirmBtn.removeEventListener('click', confirmHandler);
            app.modals.confirmCancelBtn.removeEventListener('click', cancelHandler);
            app.modals.backdrop.removeEventListener('click', backdropHandler);
            closeModal(app.modals.confirm);
        };

        app.modals.confirmConfirmBtn.addEventListener('click', confirmHandler);
        app.modals.confirmCancelBtn.addEventListener('click', cancelHandler);
        app.modals.backdrop.addEventListener('click', backdropHandler);
    });
};

// --- START: Heading Navigation Pill Logic ---
const updateHeadingNav = () => {
    if (!state.settings.activeNoteId) {
        headingNavPill.classList.add('hidden');
        return;
    }

    const editor = app.elements.noteEditorBody;
    const headings = Array.from(editor.querySelectorAll('h1, h2, h3'));

    if (headings.length === 0) {
        headingNavPill.classList.add('hidden');
        if (headingObserver) headingObserver.disconnect();
        return;
    }

    headingNavPill.classList.remove('hidden');
    headingNavDots.innerHTML = '';
    headingNavTooltipContent.innerHTML = '';
    if (headingObserver) headingObserver.disconnect();

    headings.forEach((heading, index) => {
        const headingId = `heading-nav-${index}`;
        heading.id = headingId;

        const headingType = heading.tagName.toLowerCase(); // "h1", "h2", etc.

// Create the dot
const dot = document.createElement('a');
// ADDED a class based on heading type
dot.className = `heading-nav-dot heading-dot-${headingType}`;
dot.dataset.targetId = headingId;
headingNavDots.appendChild(dot);

// Create the tooltip item
const tooltipItem = document.createElement('a');
// ADDED a class based on heading type
tooltipItem.className = `heading-tooltip-item heading-tooltip-${headingType}`;
tooltipItem.dataset.targetId = headingId;
tooltipItem.textContent = heading.textContent.trim();
headingNavTooltipContent.appendChild(tooltipItem);
    });

    setupHeadingObserver(headings);
};

const scrollToHeading = (headingId) => {
    const headingElement = document.getElementById(headingId);
    if (!headingElement) return;

    const scrollContainer = document.getElementById('main-content-area');
    const header = document.getElementById('main-header');
    
    // Calculate the height of the header to offset the scroll
    const headerHeight = header ? header.offsetHeight : 65;
    
    // Calculate the position of the heading relative to the scrollable container
    const targetOffsetTop = headingElement.offsetTop;
    
    // Determine the final scroll position, with a 20px padding for comfort
    const targetScrollTop = targetOffsetTop - headerHeight - 20;

    // Use the reliable scrollTo method, which does NOT trigger focus/mousedown events
    scrollContainer.scrollTo({
        top: Math.max(0, targetScrollTop), // Ensure we don't scroll to a negative position
        behavior: 'smooth'
    });
};
const setupHeadingObserver = (headings) => {
    const options = {
        root: document.getElementById('main-content-area'), // Scrollable container
        rootMargin: '0px 0px -80% 0px', // Trigger when heading is in the top 20% of the view
        threshold: 0
    };

    headingObserver = new IntersectionObserver((entries) => {
        let topmostVisibleEntry = null;
        for (const entry of entries) {
            if (entry.isIntersecting) {
                if (!topmostVisibleEntry || entry.boundingClientRect.top < topmostVisibleEntry.boundingClientRect.top) {
                    topmostVisibleEntry = entry;
                }
            }
        }

        document.querySelectorAll('.heading-nav-dot, .heading-tooltip-item').forEach(el => el.classList.remove('active'));

        if (topmostVisibleEntry) {
            const activeId = topmostVisibleEntry.target.id;
            document.querySelectorAll(`[data-target-id="${activeId}"]`).forEach(el => el.classList.add('active'));
        }
    }, options);

    headings.forEach(heading => headingObserver.observe(heading));
};

const initHeadingNav = () => {
    let hideTimeout; // This will manage our timer

    const showTooltip = () => {
        clearTimeout(hideTimeout);
        const tooltip = document.getElementById('heading-nav-tooltip');
        tooltip.classList.remove('opacity-0', 'pointer-events-none');
    };

    const hideTooltip = () => {
        hideTimeout = setTimeout(() => {
            const tooltip = document.getElementById('heading-nav-tooltip');
            tooltip.classList.add('opacity-0', 'pointer-events-none');
        }, 200); // A 200ms delay before hiding
    };

    // Show tooltip when mouse enters the pill
    headingNavPill.addEventListener('mouseenter', showTooltip);
    // Start the hide timer when mouse leaves the pill
    headingNavPill.addEventListener('mouseleave', hideTooltip);

    // Also apply this logic to the tooltip itself
    const tooltipElement = document.getElementById('heading-nav-tooltip');
    tooltipElement.addEventListener('mouseenter', showTooltip); // Cancel hiding if mouse enters tooltip
    tooltipElement.addEventListener('mouseleave', hideTooltip); // Hide when mouse leaves tooltip

    // Click listener for both dots and tooltip items (remains the same)
    headingNavPill.addEventListener('click', (e) => {
        const target = e.target.closest('[data-target-id]');
        if (target) {
            e.preventDefault();
            scrollToHeading(target.dataset.targetId);
        }
    });
    // START: New Hover Interaction Logic
const dotsContainer = document.getElementById('heading-nav-dots');

dotsContainer.addEventListener('mouseover', (e) => {
    const dot = e.target.closest('.heading-nav-dot');
    if (dot) {
        const targetId = dot.dataset.targetId;
        const tooltipItem = document.querySelector(`.heading-tooltip-item[data-target-id="${targetId}"]`);
        if (tooltipItem) {
            tooltipItem.classList.add('hover-active');
        }
    }
});

dotsContainer.addEventListener('mouseout', (e) => {
    const dot = e.target.closest('.heading-nav-dot');
    if (dot) {
        const targetId = dot.dataset.targetId;
        const tooltipItem = document.querySelector(`.heading-tooltip-item[data-target-id="${targetId}"]`);
        if (tooltipItem) {
            tooltipItem.classList.remove('hover-active');
        }
    }
});
// END: New Hover Interaction Logic

    const debouncedUpdate = debounce(updateHeadingNav, 300);

    mutationObserver = new MutationObserver((mutations) => {
        debouncedUpdate();
    });

    const observerConfig = { childList: true, subtree: true, characterData: true };
    mutationObserver.observe(app.elements.noteEditorBody, observerConfig);
};
// --- END: Heading Navigation Pill Logic ---
// ADD THIS ENTIRE FUNCTION
const openLinkModal = () => {
    return new Promise((resolve) => {
        const modal = document.getElementById('link-modal');
        const input = document.getElementById('link-modal-input');
        const resultsContainer = document.getElementById('link-modal-results');
        const closeBtn = document.getElementById('link-modal-close-btn');

        // Store the selection when the modal opens
        const savedRange = editorSelectionRange ? editorSelectionRange.cloneRange() : null;

        const currentNoteId = state.settings.activeNoteId;
        const allNotes = getAllNotes(state.collections).filter(note => note.id !== currentNoteId);
        const fuse = new Fuse(allNotes, { keys: ['name'], threshold: 0.4 });

        const cleanupAndClose = (result = null) => {
            input.removeEventListener('input', handleSearch);
            resultsContainer.removeEventListener('click', handleResultClick);
            closeBtn.removeEventListener('click', () => cleanupAndClose());
            document.removeEventListener('keydown', handleEsc);
            closeModal(modal);
            resolve({ result, range: savedRange });
        };

        const renderResults = (items, isUrl = false) => {
            if (isUrl) {
                resultsContainer.innerHTML = `
                    <div class="link-modal-item p-2 rounded-md hover:bg-bg-pane-dark cursor-pointer" data-url="${items}">
                        <div class="flex items-center gap-3">
                            <i data-feather="link" class="w-5 h-5 text-text-secondary flex-shrink-0"></i>
                            <div class="min-w-0">
                                <div class="font-semibold text-text-primary truncate">Link to web page</div>
                                <div class="text-sm text-text-secondary truncate">${items}</div>
                            </div>
                        </div>
                    </div>`;
            } else {
                if (items.length === 0) {
                    resultsContainer.innerHTML = `<p class="p-4 text-center text-sm text-text-tertiary">No notes found.</p>`;
                    return;
                }
                resultsContainer.innerHTML = items.map(note => {
                    const findResult = findItem(note.id);
                    const parentName = (findResult && findResult.parent && !Array.isArray(findResult.parent)) ? findResult.parent.name : 'Uncategorized';
                    return `
                        <div class="link-modal-item p-2 rounded-md hover:bg-bg-pane-dark cursor-pointer" data-note-id="${note.id}" data-note-name="${note.name.replace(/"/g, '&quot;')}">
                            <div class="flex items-center gap-3">
                                <i data-feather="file-text" class="w-5 h-5 text-text-secondary flex-shrink-0"></i>
                                <div class="min-w-0">
                                    <div class="font-semibold text-text-primary truncate">${note.name}</div>
                                    <div class="text-sm text-text-secondary truncate">${parentName}</div>
                                </div>
                            </div>
                        </div>`;
                }).join('');
            }
            feather.replace();
        };

        const handleSearch = () => {
            const query = input.value.trim();
            if (/(^https?:\/\/)|(\w+\.\w{2,})/.test(query) && !query.includes(' ')) {
                renderResults(query, true);
            } else if (query === "") {
                const recentNotes = [...allNotes].sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt)).slice(0, 5);
                renderResults(recentNotes);
            } else {
                const searchResults = fuse.search(query).map(result => result.item);
                renderResults(searchResults);
            }
        };

        const handleResultClick = (e) => {
            const item = e.target.closest('.link-modal-item');
            if (!item) return;

            if (item.dataset.noteId) {
                cleanupAndClose({ type: 'internal', id: item.dataset.noteId, name: item.dataset.noteName });
            } else if (item.dataset.url) {
                cleanupAndClose({ type: 'external', url: item.dataset.url });
            }
        };
        
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                cleanupAndClose();
            }
        };

        input.value = '';
        handleSearch(); // Initial render with recents
        openModal(modal);
        input.focus();
        input.addEventListener('input', handleSearch);
        resultsContainer.addEventListener('click', handleResultClick);
        closeBtn.addEventListener('click', () => cleanupAndClose());
        document.addEventListener('keydown', handleEsc, { once: true });
    });
};
            
            function render() {
    renderTheme();
    renderSidebarState();
    renderCollectionsList();
    renderTagList();
    renderTagsState();
    //renderChatbotState(); // This line is removed
    renderMainView();
    renderMobileControls();

    // --- START: NEW CONSOLIDATED LOGIC ---
    const fab = document.getElementById('chatbot-fab');
    const toggleBtn = document.getElementById('chatbot-toggle-btn');

    if (state.settings.chatbotVisible) {
        fab.style.display = 'flex'; // Use style.display for direct control
        toggleBtn.querySelector('span').textContent = 'Hide Chatbot Button';
    } else {
        fab.style.display = 'none'; // Use style.display for direct control
        toggleBtn.querySelector('span').textContent = 'Show Chatbot Button';
    }
    const propertiesBtn = document.getElementById('toggle-properties-btn');
if (propertiesBtn) {
    const icon = propertiesBtn.querySelector('i, svg');
    const text = propertiesBtn.querySelector('span');
    if (state.settings.propertiesVisible) {
        text.textContent = 'Hide Properties';
        icon.setAttribute('data-feather', 'eye-off');
    } else {
        text.textContent = 'Show Properties';
        icon.setAttribute('data-feather', 'eye');
    }
}
    // --- END: NEW CONSOLIDATED LOGIC ---


    const noteActive = !!state.settings.activeNoteId;
    document.getElementById('header-share-btn').style.display = noteActive ? 'flex' : 'none';
    document.getElementById('header-summarize-btn').style.display = noteActive ? 'flex' : 'none';
    document.getElementById('header-quiz-btn').style.display = noteActive ? 'flex' : 'none';
    document.getElementById('header-flashcard-btn').style.display = noteActive ? 'flex' : 'none';

    app.toolbar.editorModeToggle.disabled = !noteActive;
    app.toolbar.dictateBtn.disabled = !noteActive || !speechRecognizer;
    app.toolbar.graphBtn.disabled = !noteActive;
    document.getElementById('header-template-btn').style.display = noteActive ? 'flex' : 'none';
    document.getElementById('header-collaborate-btn').style.display = noteActive ? 'flex' : 'none';

    feather.replace();
}
            
            function renderTheme() {
                const docEl = document.documentElement;
                docEl.classList.remove('reputify-theme', 'dark', 'light');
                app.elements.themeReputifyIcon.classList.add('hidden');
                app.elements.themeSunIcon.classList.add('hidden');
                app.elements.themeMoonIcon.classList.add('hidden');

                if (state.settings.theme === 'dark') {
                    docEl.classList.add('dark');
                    app.elements.themeMoonIcon.classList.remove('hidden');
                    app.elements.themeText.textContent = 'Dark Theme';
                } else if (state.settings.theme === 'reputify') {
                    docEl.classList.add('reputify-theme');
                    app.elements.themeReputifyIcon.classList.remove('hidden');
                    app.elements.themeText.textContent = 'Reputify Theme';
                } else {
                    docEl.classList.add('light');
                    app.elements.themeSunIcon.classList.remove('hidden');
                    app.elements.themeText.textContent = 'Light Theme';
                }
                const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--bg-main').trim();
const themeMeta = document.getElementById('theme-color-meta');
if (themeMeta) {
    themeMeta.setAttribute('content', themeColor);
}
            }
            
            function renderSidebarState() {
                const pane = app.elements.notesListPane;
                const resizer = app.elements.paneResizer;
                const body = app.elements.body;
                const toggleBtn = app.elements.sidebarToggleBtn;

                if (state.settings.sidebarCollapsed) {
                    pane.classList.add('collapsed');
                    resizer.classList.add('hidden');
                    body.classList.add('sidebar-collapsed');
                    toggleBtn.style.left = '0px';
                } else {
                    pane.classList.remove('collapsed');
                    pane.style.width = `${state.settings.paneWidth}px`;
                    resizer.classList.remove('hidden');
                    body.classList.remove('sidebar-collapsed');
                    toggleBtn.style.left = `${state.settings.paneWidth}px`;
                }
            }

            function renderCollectionsList(collections = state.collections, level = 0) {
    // Helper function to create the HTML for a single item (note or folder)
    const createItemHTML = (item, currentLevel) => {
        const isActive = item.id === state.settings.activeCollectionId;
        const isNoteActive = item.id === state.settings.activeNoteId;
        const isFolder = item.type === 'folder';

        let newNoteParentId = null;
        if (isFolder) {
            newNoteParentId = item.id;
        } else {
            const findResult = findItem(item.id);
            const parent = findResult ? findResult.parent : null;
            if (parent && !Array.isArray(parent)) {
                newNoteParentId = parent.id;
            }
        }

        let sharedIconHTML = '';
        const noteData = window.noteCache[item.id];
        const user = window.auth.currentUser;
        const isSharedWithMe = noteData && user && noteData.ownerId !== user.uid;

        // Add the 'users' icon only if it's a shared note
        if (item.type === 'note' && isSharedWithMe) {
            sharedIconHTML = `<i data-feather="users" class="w-4 h-4 text-text-secondary ml-auto mr-2" title="Shared with you"></i>`;
        }
        // --- START: NEW AI-GENERATED ICON LOGIC ---
        // If the note is AI-generated, add the 'box' icon
        if (item.isAiGenerated) {
            sharedIconHTML += `<i data-feather="box" class="w-4 h-4 text-accent-primary ml-auto mr-2" title="AI Agent Generated"></i>`;
        }
        // --- END: NEW AI-GENERATED ICON LOGIC ---

        if (isFolder && item.children) {
            item.children.sort((a, b) => {
                if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
                return a.name.localeCompare(b.name);
            });
        }

        return `
            <li data-id="${item.id}" draggable="true" class="collection-item-wrapper group rounded-md">
                <div class="collection-item flex items-center justify-between gap-2 p-2 rounded-md hover:bg-bg-pane-dark ${isActive || isNoteActive ? 'bg-bg-pane-dark font-semibold' : ''}" style="padding-left: ${8 + currentLevel * 16}px;">
                    <a href="#" class="collection-item-link flex items-center gap-2 flex-grow min-w-0">
                        ${isFolder ? `<i data-feather="chevron-right" class="chevron w-4 h-4 flex-shrink-0 text-text-tertiary ${item.expanded ? 'open' : ''}"></i>` : ''}
                        ${!isSharedWithMe ? `<i data-feather="${isFolder ? 'folder' : (item.pinned ? 'paperclip' : 'file-text')}" class="w-4 h-4 flex-shrink-0 text-text-secondary ${item.pinned ? 'text-accent-primary': ''}"></i>` : ''}
                        <span class="truncate">${item.name}</span>
                    </a>
                    ${sharedIconHTML}
                    <button class="add-note-btn opacity-0 group-hover:opacity-100 transition-opacity" data-parent-id="${newNoteParentId}" title="Add New Note">
                        <i data-feather="plus" class="w-4 h-4 pointer-events-none"></i>
                    </button>
                </div>
                ${isFolder && item.expanded && item.children ? `<ul class="collection-children">${renderCollectionsList(item.children, currentLevel + 1)}</ul>` : ''}
            </li>
        `;
    };

    // --- NEW LOGIC IS HERE ---
    // This only runs for the top-level rendering (level 0)
    if (level === 0) {
        const user = window.auth.currentUser;
        const userItems = [];
        const sharedItems = [];

        // 1. Separate user's own items from shared items
        collections.forEach(item => {
            const noteData = window.noteCache[item.id];
            if (item.type === 'note' && user && noteData && noteData.ownerId !== user.uid) {
                sharedItems.push(item);
            } else {
                userItems.push(item);
            }
        });

        // 2. Sort both lists independently
        userItems.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
        sharedItems.sort((a, b) => a.name.localeCompare(b.name));
        
        // 3. Build the final HTML string with the new structure
        let finalHTML = `<ul class="space-y-1">${userItems.map(item => createItemHTML(item, 0)).join('')}</ul>`;

        if (sharedItems.length > 0) {
            finalHTML += `
                <div class="px-2 pt-4 pb-1">
                    <h3 class="font-bold text-xs uppercase tracking-wider text-text-tertiary">Shared with You</h3>
                </div>
                <ul class="space-y-1">${sharedItems.map(item => createItemHTML(item, 0)).join('')}</ul>
            `;
        }

        app.containers.collectionsList.innerHTML = finalHTML;
        feather.replace();

    } else {
        // For nested levels (folders), render as before
        collections.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
        return collections.map(item => createItemHTML(item, level)).join('');
    }
}
            function renderTagList() {
    const allNotes = getAllNotes(state.collections);
    // Get a flat list of all tags, including duplicates.
    const allTagsRaw = allNotes.flatMap(note => note.tags || []);

    if (allTagsRaw.length === 0) {
        app.containers.tagList.innerHTML = `<p class="px-2 text-xs text-text-tertiary">No tags found.</p>`;
        return;
    }

    // Create a frequency map to count how many times each tag is used.
    const tagCounts = allTagsRaw.reduce((acc, tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
    }, {});

    // Get the unique tags and sort them alphabetically.
    const uniqueTags = [...new Set(allTagsRaw)].sort();

    // Update the HTML to include the count in a styled badge.
    app.containers.tagList.innerHTML = uniqueTags.map(tag => {
        const count = tagCounts[tag];
        return `
            <a href="#" class="tag-filter-item flex justify-between items-center text-sm p-1 px-2 rounded-md text-text-secondary hover:bg-bg-pane-dark hover:text-text-primary ${state.settings.activeTag === tag ? 'active' : ''}" data-tag="${tag}">
                <span>#${tag}</span>
                <span class="text-xs bg-bg-pane-dark rounded-full px-1.5 py-0.5 ml-2">${count}</span>
            </a>
        `
    }).join('');
}

            

            function updateNoteTags(note) {
    if (!note || typeof note.content !== 'string') return;
    // This regex now allows letters, numbers, underscores, and hyphens in tags.
    const plainText = note.content.replace(/<[^>]*>?/gm, ' ');
    const matches = plainText.match(/#([a-zA-Z0-9_-]+)/g) || [];
    note.tags = [...new Set(matches.map(tag => tag.substring(1)))];
}

            function updateNoteLinks(note) {
                if (!note || typeof note.content !== 'string') return;
                const plainText = note.content.replace(/<[^>]*>?/gm, '');
                const matches = plainText.matchAll(/\[\[(.*?)\]\]/g);
                note.links = [...matches].map(match => match[1].trim());
            }

            function renderMainView() {
    // Set a default title first
    document.title = 'Reputifly | AI Note Taker';

    document.querySelectorAll('.notes-view').forEach(v => v.classList.add('hidden'));
    document.body.classList.remove('mobile-editor-active');
    document.getElementById('main-header')?.classList.remove('hidden');
    document.getElementById('mobile-sticky-toolbar')?.classList.add('hidden');

    if (isSearchActive) {
        renderSearchResults(app.search.input.value);
        return;
    }
    
    const isNoteActive = !!state.settings.activeNoteId;
    const isTagActive = !!state.settings.activeTag;
    const activeCollection = findItem(state.settings.activeCollectionId)?.item;

    // Logic to set the UI header and browser tab title
    if (isTagActive) {
        const title = `Tag: #${state.settings.activeTag}`;
        app.elements.currentViewTitle.textContent = title;
        document.title = `#${state.settings.activeTag} | Reputifly Notes`;
    } else if (activeCollection) {
        app.elements.currentViewTitle.textContent = activeCollection.name;
        document.title = `${activeCollection.name} | Reputifly Notes`;
    } else {
        app.elements.currentViewTitle.textContent = "All Notes";
    }
    
    const showListControls = !isNoteActive && (state.settings.activeView === 'list' || !activeCollection || isTagActive);

    app.elements.viewSwitcher.style.display = isNoteActive || !activeCollection || isTagActive ? 'none' : 'flex';
    app.elements.listViewControls.style.display = showListControls ? 'flex' : 'none';
    
    if (isNoteActive) {
        // This function will override the title again with the specific note name
        renderNoteEditor();
    } else if (isTagActive) {
        renderListView();
    } else if (activeCollection) {
         document.querySelectorAll('#view-switcher-container .view-btn').forEach(b => b.classList.remove('active'));
         document.querySelector(`#view-switcher-container .view-btn[data-view="${state.settings.activeView}"]`)?.classList.add('active');
        
        if (state.settings.activeView === 'board') {
            renderKanbanView();
        } else if (state.settings.activeView === 'calendar') {
            renderCalendarView();
        } else if (state.settings.activeView === 'gallery') {
            renderGalleryView();
        } else {
            renderListView();
        }
    } else {
         renderListView();
    }
}
            
            function renderMobileControls() {
    const activeCollection = findItem(state.settings.activeCollectionId)?.item;
    const note = findItem(state.settings.activeNoteId)?.item;
    const isNoteActive = !!note;

    let controlsHTML = '';
    
    if (isNoteActive) {
        // This block now contains BOTH AI Tools and Note Tools
        const pinText = note.pinned ? 'Unpin Note' : 'Pin Note';
        controlsHTML = `
            <div class="text-xs text-text-tertiary px-3 pt-2 pb-1 font-semibold uppercase">AI Tools</div>
            <button class="w-full text-left px-3 py-1.5 text-sm hover:bg-bg-pane-dark rounded flex items-center gap-2" data-action="mobile-summarize">
                <i data-feather="zap" class="w-4 h-4"></i>AI Summary
            </button>
            <button class="w-full text-left px-3 py-1.5 text-sm hover:bg-bg-pane-dark rounded flex items-center gap-2" data-action="mobile-quiz">
                <i data-feather="help-circle" class="w-4 h-4"></i>MCQ Quiz
            </button>
            <button class="w-full text-left px-3 py-1.5 text-sm hover:bg-bg-pane-dark rounded flex items-center gap-2" data-action="mobile-flashcard">
    <i data-feather="copy" class="w-4 h-4"></i>Flashcards
</button>
<button class="w-full text-left px-3 py-1.5 text-sm hover:bg-bg-pane-dark rounded flex items-center gap-2" data-action="mobile-run-agent">
        <i data-feather="play-circle" class="w-4 h-4"></i>Run Agent
    </button>

            <hr class="my-1 border-border-color">

            <div class="text-xs text-text-tertiary px-3 pt-2 pb-1 font-semibold uppercase">Note Tools</div>
            <button class="w-full text-left px-3 py-1.5 text-sm hover:bg-bg-pane-dark rounded flex items-center gap-2" data-action="mobile-new-note">
    <i data-feather="file-plus" class="w-4 h-4"></i>New Note
</button>
<button class="w-full text-left px-3 py-1.5 text-sm hover:bg-bg-pane-dark rounded flex items-center gap-2" data-action="mobile-new-from-template">
    <i data-feather="file-plus" class="w-4 h-4"></i>New from Template
</button>
            <button class="w-full text-left px-3 py-1.5 text-sm hover:bg-bg-pane-dark rounded flex items-center gap-2" data-action="mobile-rename">
                <i data-feather="edit-2" class="w-4 h-4"></i>Rename
            </button>
            <button class="w-full text-left px-3 py-1.5 text-sm hover:bg-bg-pane-dark rounded flex items-center gap-2" data-action="mobile-duplicate">
                <i data-feather="copy" class="w-4 h-4"></i>Duplicate
            </button>
            <button class="w-full text-left px-3 py-1.5 text-sm hover:bg-bg-pane-dark rounded flex items-center gap-2" data-action="mobile-save-as-template">
    <i data-feather="save" class="w-4 h-4"></i>Save as Template
</button>
<button class="w-full text-left px-3 py-1.5 text-sm hover:bg-bg-pane-dark rounded flex items-center gap-2" data-action="mobile-collaborate">
    <i data-feather="users" class="w-4 h-4"></i>Collaborate
</button>

            <button class="w-full text-left px-3 py-1.5 text-sm hover:bg-bg-pane-dark rounded flex items-center gap-2" data-action="mobile-share">
    <i data-feather="share-2" class="w-4 h-4"></i>Share Note
</button>
<button class="w-full text-left px-3 py-1.5 text-sm hover:bg-bg-pane-dark rounded flex items-center gap-2" data-action="mobile-pin">
                <i data-feather="paperclip" class="w-4 h-4"></i>${pinText}
            </button>
<button class="w-full text-left px-3 py-1.5 text-sm hover:bg-bg-pane-dark rounded flex items-center gap-2" data-action="mobile-upload">
    <i data-feather="upload-cloud" class="w-4 h-4"></i>Upload File
</button>
<button class="w-full text-left px-3 py-1.5 text-sm hover:bg-bg-pane-dark rounded flex items-center gap-2" data-action="mobile-add-checklist">
    <i data-feather="check-square" class="w-4 h-4"></i>Add Checklist
</button>
<hr class="my-1 border-border-color">
<div class="text-xs text-text-tertiary px-3 pt-2 pb-1 font-semibold uppercase">Versions</div>
<button class="w-full text-left px-3 py-1.5 text-sm hover:bg-bg-pane-dark rounded flex items-center gap-2" data-action="mobile-checkpoint">
    <i data-feather="flag" class="w-4 h-4"></i>Save Checkpoint
</button>

<button class="w-full text-left px-3 py-1.5 text-sm hover:bg-bg-pane-dark rounded flex items-center gap-2" data-action="mobile-history">
    <i data-feather="clock" class="w-4 h-4"></i>Version History
</button>
            
            <hr class="my-1 border-border-color">
            <button class="w-full text-left px-3 py-1.5 text-sm hover:bg-bg-pane-dark rounded flex items-center gap-2 text-red-500" data-action="mobile-delete">
                <i data-feather="trash-2" class="w-4 h-4"></i>Delete
            </button>
        `;
    }  else if (activeCollection) {
    controlsHTML += `
        <div class="text-xs text-text-tertiary px-3 pt-2 pb-1 font-semibold uppercase">Actions</div>
        <button class="w-full text-left px-3 py-1.5 text-sm hover:bg-bg-pane-dark rounded flex items-center gap-2" data-action="mobile-new-note">
            <i data-feather="file-plus" class="w-4 h-4"></i>New Note
        </button>
        <button class="w-full text-left px-3 py-1.5 text-sm hover:bg-bg-pane-dark rounded flex items-center gap-2" data-action="mobile-rename-folder">
    <i data-feather="edit-2" class="w-4 h-4"></i>Rename Folder
</button>
        <hr class="my-1 border-border-color">
        <div class="text-xs text-text-tertiary px-3 pt-2 pb-1 font-semibold uppercase">View</div>
        <button class="w-full text-left px-3 py-1.5 text-sm hover:bg-bg-pane-dark rounded flex items-center gap-2 view-btn-mobile" data-view="calendar"><i data-feather="calendar" class="w-4 h-4"></i>Calendar</button>
        <button class="w-full text-left px-3 py-1.5 text-sm hover:bg-bg-pane-dark rounded flex items-center gap-2 view-btn-mobile" data-view="list"><i data-feather="list" class="w-4 h-4"></i>List</button>
    `; 
//...
        if (state.settings.activeView === 'list') {
            controlsHTML += `<hr class="my-1 border-border-color">
                <div class="text-xs text-text-tertiary px-3 pt-2 pb-1 font-semibold uppercase">Sort By</div>
                <select id="sort-order-mobile" class="w-full bg-transparent text-text-primary text-sm rounded-md p-2 border-0 focus:ring-0">
                    <option value="modifiedAt-desc">Last Modified</option>
                    <option value="createdAt-desc">Date Created</option>
                    <option value="name-asc">Title (A-Z)</option>
                </select>
            `;
        }controlsHTML += `
        <hr class="my-1 border-border-color">
        <button class="w-full text-left px-3 py-1.5 text-sm hover:bg-bg-pane-dark rounded flex items-center gap-2 text-red-500" data-action="mobile-delete-folder">
            <i data-feather="trash-2" class="w-4 h-4"></i>Delete Folder
        </button>
    `;
    } else {
        controlsHTML = `<div class="px-3 py-2 text-sm text-text-secondary">No options available</div>`;
    }

    app.containers.mobileControlsDropdown.innerHTML = controlsHTML;

    const mobileSortSelect = document.getElementById('sort-order-mobile');
    if (mobileSortSelect) {
        mobileSortSelect.value = state.settings.listSortOrder;
        mobileSortSelect.addEventListener('change', (e) => {
            state.settings.listSortOrder = e.target.value;
            app.elements.sortOrderSelect.value = e.target.value;
            saveState();
            renderListView();
        });
    }

    document.querySelectorAll('.view-btn-mobile').forEach(btn => {
        if (btn.dataset.view === state.settings.activeView) {
            btn.classList.add('bg-bg-pane-dark', 'font-semibold');
        }
    });
    feather.replace();
}
// ADD THIS ENTIRE NEW FUNCTION
// REPLACE THE ENTIRE renderCalendarView FUNCTION WITH THIS
// REPLACE THE ENTIRE renderCalendarView FUNCTION
function renderCalendarView() {
    const calendarView = document.getElementById('calendar-view');
    calendarView.classList.remove('hidden');
    const collectionId = state.settings.activeCollectionId;
    const collection = findItem(collectionId)?.item;

    if (!collection || collection.type !== 'folder') {
        calendarView.innerHTML = `<div class="text-center p-10 text-text-secondary"><i data-feather="calendar" class="w-12 h-12 mx-auto mb-4"></i><h3 class="font-semibold">Calendar View</h3><p>This view is only available for folders.</p></div>`;
        feather.replace();
        return;
    }

    const today = new Date();
    if (!state.calendar) state.calendar = {};
    if (!state.calendar[collectionId]) {
        state.calendar[collectionId] = { month: today.getMonth(), year: today.getFullYear() };
    }

    let { month, year } = state.calendar[collectionId];
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const startingDay = firstDayOfMonth.getDay();

    const notesInCollection = (collection.children || []).filter(note => note.type === 'note');
    const notesWithDates = notesInCollection.map(note => {
        const dateProp = Object.values(note.properties || {}).find(p => p.type === 'date' && p.value);
        return dateProp ? { ...note, eventDate: new Date(dateProp.value) } : null;
    }).filter(Boolean);

    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    let html = `
    <div class="calendar-grid-wrapper h-full">
        <header class="flex justify-between items-center mb-4 flex-shrink-0">
            <h3 class="text-xl font-semibold text-text-primary">${firstDayOfMonth.toLocaleString('default', { month: 'long' })} ${year}</h3>
            <div class="flex items-center gap-2">
                <button id="calendar-day-view-btn" class="view-btn px-2.5 py-1 rounded" title="Day View"><i data-feather="sidebar" class="w-4 h-4"></i></button>
                <button id="calendar-month-view-btn" class="view-btn px-2.5 py-1 rounded active" title="Month View"><i data-feather="calendar" class="w-4 h-4"></i></button>
                <button id="calendar-prev-month" class="p-2 rounded-md hover:bg-bg-pane-dark"><i data-feather="chevron-left" class="w-5 h-5"></i></button>
                <button id="calendar-next-month" class="p-2 rounded-md hover:bg-bg-pane-dark"><i data-feather="chevron-right" class="w-5 h-5"></i></button>
            </div>
        </header>
        <div class="grid grid-cols-7 gap-px bg-border-color border border-border-color rounded-lg flex-grow min-h-0">
            ${daysOfWeek.map(day => `<div class="text-center font-semibold text-sm py-2 bg-bg-pane-dark text-text-secondary">${day}</div>`).join('')}
    `;

    for (let i = 0; i < startingDay; i++) { html += `<div class="bg-bg-pane-light"></div>`; }

    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month, day);

        // --- THIS IS THE FIX ---
        // Manually create the YYYY-MM-DD string to avoid timezone conversion errors.
        const yyyy = currentDate.getFullYear();
        const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
        const dd = String(currentDate.getDate()).padStart(2, '0');
        const currentDateStr = `${yyyy}-${mm}-${dd}`;
        // --- END OF FIX ---

        const notesForDay = notesWithDates.filter(note => new Date(note.eventDate).toDateString() === currentDate.toDateString());

        html += `<div class="calendar-day-cell custom-scrollbar" data-date="${currentDateStr}">
            <div class="calendar-day-number" title="View Day">${day}</div>
            <div class="mt-1 space-y-1">
            ${notesForDay.map(note => {
                const selectProp = Object.values(note.properties || {}).find(p => p.type === 'select' && p.value);
                const colorClass = selectProp ? getSelectColor(selectProp.value).split(' ')[0] : 'bg-transparent';
                return `<div class="calendar-event-item" draggable="true" data-note-id="${note.id}">
                    <div class="event-color-dot ${colorClass}"></div>
                    <span class="truncate pointer-events-none">${note.name}</span>
                </div>`;
            }).join('')}
            </div>
        </div>`;
    }

    const remainingCells = (7 - ((startingDay + daysInMonth) % 7)) % 7;
    for (let i = 0; i < remainingCells; i++) { html += `<div class="bg-bg-pane-light"></div>`; }

    html += `</div></div>`;
    calendarView.innerHTML = html;
    feather.replace();
}
// END OF NEW FUNCTION
// ADD THIS ENTIRE NEW FUNCTION
function renderGalleryView() {
    const galleryView = document.getElementById('gallery-view');
    galleryView.classList.remove('hidden');

    const collectionId = state.settings.activeCollectionId;
    const collection = findItem(collectionId)?.item;

    if (!collection || collection.type !== 'folder') {
        galleryView.innerHTML = `<div class="text-center p-10 text-text-secondary"><i data-feather="grid" class="w-12 h-12 mx-auto mb-4"></i><h3 class="font-semibold">Gallery View</h3><p>This view is only available for folders.</p></div>`;
        feather.replace();
        return;
    }

    const notes = (collection.children || []).filter(note => note.type === 'note');

    if (notes.length === 0) {
        galleryView.innerHTML = `<div class="text-center p-10 text-text-secondary"><i data-feather="inbox" class="w-12 h-12 mx-auto mb-4"></i><h3 class="font-semibold">No Notes Here</h3><p>Create a new note to see it in the gallery.</p></div>`;
        feather.replace();
        return;
    }

    const cardsHTML = notes.map(note => {
        // --- Smart Cover Image Logic ---
        let coverImageHTML = '';
        let coverImageFound = false;
        // 1. Look for a specific "Cover Image" or "Image" property
        const coverProp = Object.values(noteData.properties || {}).find(p => p.type === 'image' && p.value);
        if (coverProp) {
            coverImageHTML = `<div class="h-32 bg-cover bg-center" style="background-image: url('${firstImage.src}')"></div>`;
            coverImageFound = true;
        } else {
            // 2. If not found, look for the first image in the note's content
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = noteData.content;
            const firstImage = tempDiv.querySelector('img');
            if (firstImage) {
                coverImageHTML = `<div class="h-32 bg-cover bg-center" style="background-image: url('${firstImage.src}')"></div>`;
                coverImageFound = true;
            } else {
                // 3. Fallback if no image is found
                const plainContent = noteData.content.replace(/<[^>]*>?/gm, '').trim();
                const excerpt = plainContent.substring(0, 100) + (plainContent.length > 100 ? '...' : '');
                coverImageHTML = `<div class="h-32 p-3 text-sm text-text-secondary overflow-hidden">${excerpt || 'Empty Note'}</div>`;
            }
        }

        // --- Property Display Logic ---
        const statusProp = Object.values(note.properties || {}).find(p => p.type === 'select' && p.value);
        let propertiesHTML = '';
        if (statusProp) {
            const colorClass = getSelectColor(statusProp.value);
            propertiesHTML += `<div class="mt-2"><span class="rounded px-2 py-0.5 text-xs ${colorClass}">${statusProp.value}</span></div>`;
        }

        return `
            <a href="#" class="gallery-card-item block bg-bg-pane-light border border-border-color rounded-lg overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1" data-note-id="${note.id}">
                ${coverImageHTML}
                <div class="p-3">
                    <h4 class="font-semibold text-text-primary truncate">${note.name}</h4>
                    ${propertiesHTML}
                </div>
            </a>
        `;
    }).join('');

    galleryView.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            ${cardsHTML}
        </div>
    `;
}
// ADD THIS ENTIRE NEW FUNCTION
// REPLACE THE ENTIRE renderDayView FUNCTION
// REPLACE THE ENTIRE renderDayView FUNCTION
// REPLACE THE ENTIRE renderDayView FUNCTION
function renderDayView(date) {
    const calendarView = document.getElementById('calendar-view');
    const collectionId = state.settings.activeCollectionId;
    const collection = findItem(collectionId)?.item;
    if (!collection) return;

    // --- THIS IS THE FIX ---
    // Manually create a timezone-independent YYYY-MM-DD string for the data attribute.
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const dateStringForData = `${yyyy}-${mm}-${dd}`;
    // --- END OF FIX ---

    const notesInCollection = (collection.children || []).filter(note => note.type === 'note');
    const notesForDay = notesInCollection.map(note => {
        const dateProp = Object.values(note.properties || {}).find(p => p.type === 'date' && p.value);
        if (dateProp) {
            const eventDate = new Date(dateProp.value);
            if (eventDate.toDateString() === date.toDateString()) {
                const endDate = dateProp.endValue ? new Date(dateProp.endValue) : null;
                return { ...note, eventDate, endDate };
            }
        }
        return null;
    }).filter(Boolean);

    const allDayEvents = notesForDay.filter(note => !note.eventDate.toTimeString().startsWith('00:00:00') && (!note.endDate || (note.endDate.getTime() - note.eventDate.getTime()) >= 86400000));
    const timedEvents = notesForDay.filter(note => !allDayEvents.includes(note));
    timedEvents.sort((a, b) => a.eventDate - b.eventDate);

    // Use the new timezone-safe date string in the container's data attribute
    let html = `<div class="day-view-container" data-date="${dateStringForData}"> 
        <header class="flex justify-between items-center mb-4 flex-shrink-0">
            <h3 class="text-xl font-semibold text-text-primary">${date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
            <div class="flex items-center gap-2">
                <button id="calendar-month-view-btn" class="view-btn px-2.5 py-1 rounded"><i data-feather="calendar" class="w-4 h-4 mr-2"></i>Back to Month</button>
            </div>
        </header>

        <div class="day-view-timeline-wrapper custom-scrollbar">
            <div class="relative h-[1152px]">
                <div class="day-view-grid">
                    ${Array.from({ length: 24 }).map((_, hour) => {
                        const time = new Date(); time.setHours(hour, 0);
                        return `<div class="day-view-hour-slot" data-time="${time.toLocaleTimeString(undefined, { hour: 'numeric', hour12: true })}"></div>`;
                    }).join('')}
                </div>
                <div class="absolute top-0 bottom-0 left-20 right-0">
                    ${timedEvents.map(note => {
                        const startMinutes = note.eventDate.getHours() * 60 + note.eventDate.getMinutes();
                        const endMinutes = note.endDate ? (note.endDate.getHours() * 60 + note.endDate.getMinutes()) : (startMinutes + 60);
                        const duration = Math.max(30, endMinutes - startMinutes);
                        const top = (startMinutes / 60) * 48;
                        const height = (duration / 60) * 48;
                        const selectProp = Object.values(note.properties || {}).find(p => p.type === 'select' && p.value);
                        const styleColor = selectProp ? getComputedStyle(document.documentElement).getPropertyValue('--' + getSelectColor(selectProp.value).split(' ')[0].replace('bg-','').replace('-500/20','-400')) : 'var(--accent-primary)';

                        const startTime = note.eventDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit'});
                        const endTime = note.endDate ? note.endDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit'}) : '';
                        const timeString = endTime ? `${startTime} - ${endTime}` : startTime;

                        return `
                            <a href="#" class="day-view-event-link absolute left-1 right-2" data-note-id="${note.id}" style="top: ${top}px; height: ${height}px;">
                                <div class="day-view-event h-full p-2 rounded flex flex-col" style="border-left-width: 3px; border-left-color: ${styleColor}; background-color: ${styleColor.replace(')',', 0.1)')};">
                                    <div class="font-semibold text-text-primary text-sm truncate leading-tight">${note.name}</div>
                                    <div class="text-xs text-text-secondary mt-1">${timeString}</div>
                                </div>
                            </a>`;
                    }).join('')}
                    ${new Date().toDateString() === date.toDateString() ? '<div id="now-indicator"></div>' : ''}
                </div>
            </div>
        </div>
    </div>`;
    calendarView.innerHTML = html;
    feather.replace();

    if (document.getElementById('now-indicator')) {
        updateNowIndicator();
        setInterval(updateNowIndicator, 60000);
        const now = new Date();
        const minutes = now.getHours() * 60 + now.getMinutes();
        const scrollPos = (minutes / 60) * 48 - 100;
        document.querySelector('.day-view-timeline-wrapper').scrollTop = Math.max(0, scrollPos);
    }
}
// END OF NEW FUNCTION
            function renderKanbanView() {
    app.views.board.classList.remove('hidden');
    const collectionId = state.settings.activeCollectionId;
    const collection = findItem(collectionId)?.item;

    if (!collection || collection.type !== 'folder') {
        app.containers.kanbanBoard.innerHTML = `<div class="text-center p-10 text-text-secondary"><i data-feather="trello" class="w-12 h-12 mx-auto mb-4"></i><h3 class="font-semibold">Board View</h3><p>This view is only available for project folders.</p></div>`;
        feather.replace();
        return;
    }
    
    const columns = state.kanbanColumns[collectionId] || [];
    const notesInCollection = (collection.children || []).filter(c => c.type === 'note');
    
    // --- START: KANBAN FIX & MIGRATION ---
    // This new logic checks every note and assigns it to the first column if its status is missing or invalid.
    if (columns.length > 0) {
        let needsSave = false;
        const firstColumnId = columns[0].id;
        const validColumnIds = new Set(columns.map(c => c.id));

        notesInCollection.forEach(note => {
            if (!note.status || !validColumnIds.has(note.status)) {
                note.status = firstColumnId;
                needsSave = true;
            }
        });

        // If we fixed any notes, save the changes back to the database.
        if (needsSave) {
            console.log("Kanban view is correcting note statuses...");
            saveState();
        }
    }
    // --- END: KANBAN FIX & MIGRATION ---
    
    const columnsHTML = columns.map(column => {
        const notesInColumn = notesInCollection.filter(note => note.status === column.id);
            
        const cardsHTML = notesInColumn.map(note => {
                const date = formatDateTime(note.modifiedAt);
                const pinnedClass = note.pinned ? 'pinned' : '';
                return `
                    <div class="kanban-card p-3 rounded-md shadow-sm border border-border-color mb-3 cursor-pointer hover:shadow-lg transition-all ${pinnedClass}" draggable="true" data-note-id="${note.id}">
                        <div class="pointer-events-none flex-grow overflow-hidden">
                            <h4 class="font-semibold pointer-events-none truncate">${note.name}</h4>
                            <p class="text-sm text-text-secondary mt-1 pointer-events-none truncate-multiline card-content">${note.excerpt || ''}</p>
                        </div>
                        <div class="text-xs text-text-tertiary mt-2 pointer-events-none flex-shrink-0">Modified: ${date}</div>
                    </div>
                `;
            }).join('');

        return `
            <div class="kanban-column w-[280px] md:w-[300px] flex-shrink-0 bg-bg-pane-dark p-3 rounded-lg" data-column-id="${column.id}">
                <div class="column-header flex justify-between items-center font-semibold mb-3 text-text-primary">
                    <span class="rename-column-btn cursor-pointer flex-grow p-1">${column.title}</span>
                    <button class="delete-column-btn text-text-tertiary hover:text-red-500 opacity-0 transition-opacity p-1"><i data-feather="x" class="w-4 h-4"></i></button>
                </div>
                <div class="cards-container min-h-[100px]">${cardsHTML}</div>
            </div>
        `;
    }).join('');
    
    const addColumnBtnHTML = columns.length < 5 ? `
         <div class="w-[280px] md:w-[300px] flex-shrink-0">
            <button id="add-column-btn" class="w-full bg-bg-pane-light p-3 rounded-lg text-text-secondary hover:bg-main hover:text-accent-primary transition-colors">
                <i data-feather="plus" class="inline-block mr-2"></i>Add Column
            </button>
        </div>` : '';

    app.containers.kanbanBoard.innerHTML = columnsHTML + addColumnBtnHTML;
    feather.replace();
}

function renderListView() {
    app.views.list.classList.remove('hidden');
    let notes = [];
    const activeTag = state.settings.activeTag;

    if (activeTag) {
        notes = getAllNotes(state.collections).filter(note => (note.tags || []).includes(activeTag));
    } else {
        const collectionId = state.settings.activeCollectionId;
        const collection = findItem(collectionId)?.item;
        notes = collection ?
            (collection.children || []).filter(c => c.type === 'note') :
            getAllNotes(state.collections);
    }

    if (notes.length === 0) {
        app.containers.notesListContent.innerHTML = `<div class="text-center p-10 text-text-secondary col-span-full"><i data-feather="inbox" class="w-12 h-12 mx-auto mb-4"></i><h3 class="font-semibold">No Notes Here</h3><p>Create a new note to see it here.</p></div>`;
        feather.replace();
        return;
    }

    const sortOrder = state.settings.listSortOrder;
    const [key, direction] = sortOrder.split('-');

    notes.sort((a, b) => {
        let valA = a[key];
        let valB = b[key];
        if (key === 'name') {
            return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
            return direction === 'desc' ? new Date(valB) - new Date(valA) : new Date(valA) - new Date(valB);
        }
    });

    app.containers.notesListContent.innerHTML = notes.map(note => {
        // ADD THIS LINE
const noteData = window.noteCache[note.id] || { content: '', properties: {} };
    const pinnedClass = note.pinned ? 'pinned' : '';

    let coverImageHTML = '';
    const coverProp = Object.values(noteData.properties || {}).find(p => p.type === 'image' && p.value);
    if (coverProp) {
        coverImageHTML = `<div class="h-32 bg-contain bg-no-repeat bg-center mb-4" style="background-image: url('${coverProp.value}')"></div>`;
    } else {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = noteData.content;
        const firstImage = tempDiv.querySelector('img');
        if (firstImage) {
            coverImageHTML = `<div class="h-32 bg-contain bg-no-repeat bg-center mb-4" style="background-image: url('${firstImage.src}')"></div>`;
        }
    }

    let allPropertiesHTML = '';
    const props = noteData.properties || {};
    const sortedPropNames = Object.keys(props)
        .filter(propName => props[propName].type !== 'image' && props[propName].value)
        .sort();

    if (sortedPropNames.length > 0) {
        const propsList = sortedPropNames.map(propName => {
            const prop = props[propName];
            const propNameDisplay = `<span class="text-text-tertiary">${propName}:</span>`;
            let valueDisplay = '';

            if (prop.type === 'date') {
                const formattedDate = new Date(prop.value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                return `<button class="list-view-jump-to-date-btn flex items-center gap-1.5 text-xs hover:bg-bg-pane-dark rounded-md" data-note-id="${note.id}" data-date-value="${prop.value}">
                            ${propNameDisplay}
                            <span class="text-text-primary font-medium">${formattedDate}</span>
                        </button>`;
            } else if (prop.type === 'select') {
                valueDisplay = `<span class="rounded px-1.5 py-0.5 text-xs font-medium ${getSelectColor(prop.value)}">${prop.value}</span>`;
            } else {
                valueDisplay = `<span class="text-text-primary font-medium truncate max-w-[150px] inline-block align-bottom">${prop.value}</span>`;
            }

            return `<div class="flex items-center gap-1.5 text-xs">${propNameDisplay} ${valueDisplay}</div>`;
        }).join('');

        if (propsList) {
            allPropertiesHTML = `<div class="flex items-center gap-x-3 whitespace-nowrap">${propsList}</div>`;
        }
    }
    
    let allChecklistsHTML = '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = noteData.content;
    const allChecklists = tempDiv.querySelectorAll('.checklist-container');

    if (allChecklists.length > 0) {
        const checklistsPreviews = Array.from(allChecklists).map((checklistEl, checklistIndex) => {
            const title = checklistEl.querySelector('.checklist-title')?.textContent.trim() || 'Checklist';
            const items = Array.from(checklistEl.querySelectorAll('.checklist-item'));
            const totalItems = items.length;
            
            // --- THIS LINE IS NEW ---
            const completedItems = checklistEl.querySelectorAll('.checklist-item.checked').length;

            if (totalItems === 0) return ''; 

            const itemsHTML = items.map((item, itemIndex) => {
                const isChecked = item.classList.contains('checked');
                const text = item.querySelector('.checklist-item-text')?.textContent || '';
                return `
                    <li class="checklist-preview-item ${isChecked ? 'checked' : ''}">
                        <label class="flex items-center gap-3 cursor-pointer w-full p-1 rounded hover:bg-bg-pane-dark">
                            <input type="checkbox" 
                                   ${isChecked ? 'checked' : ''} 
                                   data-note-id="${note.id}" 
                                   data-checklist-index="${checklistIndex}" 
                                   data-item-index="${itemIndex}">
                            <span class="flex-grow">${text.replace(/</g, "&lt;")}</span>
                        </label>
                    </li>
                `;
            }).join('');

            return `
                <div class="list-view-checklist-preview">
                    <div class="checklist-preview-header">
                        <div class="flex items-center gap-2 min-w-0">
                            <i data-feather="check-square" class="w-4 h-4 text-text-tertiary flex-shrink-0"></i>
                            <span class="font-medium truncate">${title}</span>
                            
                            <span class="text-xs text-text-tertiary bg-bg-main px-1.5 py-0.5 rounded-full flex-shrink-0">${completedItems}/${totalItems} Done</span>

                        </div>
                        <i data-feather="chevron-down" class="w-4 h-4 text-text-tertiary transition-transform flex-shrink-0"></i>
                    </div>
                    <div class="checklist-preview-body" style="display: none;">
                        <ul>${itemsHTML}</ul>
                    </div>
                </div>
            `;
        }).join('');

        if (checklistsPreviews) {
            allChecklistsHTML = `<div class="space-y-2">${checklistsPreviews}</div>`;
        }
    }
    
    const excerpt = note.excerpt || 'No content preview...';
    const modifiedDate = formatDateTime(note.modifiedAt);

    return `
        <div class="list-note-item flex flex-col bg-bg-pane-light border border-border-color rounded-lg overflow-hidden transition-all hover:shadow-md ${pinnedClass}" data-note-id="${note.id}">
            <a href="#" class="note-link-area block p-4 flex-grow">
                ${coverImageHTML}
                <h4 class="font-semibold text-lg text-text-primary truncate">${note.name}</h4>
                <p class="text-sm text-text-secondary mt-2" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                    ${excerpt || 'No content preview...'}
                </p>
            </a>

            ${allPropertiesHTML ? `
            <div class="px-4 py-2 border-t border-border-color">
                <div class="overflow-x-auto no-scrollbar">
                    ${allPropertiesHTML}
                </div>
            </div>
            ` : ''}

            ${allChecklistsHTML ? `
            <div class="list-view-all-checklists-container">
                ${allChecklistsHTML}
            </div>
            ` : ''}

            <div class="px-4 pb-3 pt-2 ${allPropertiesHTML || allChecklistsHTML ? '' : 'border-t border-border-color'} flex justify-between items-center">
                <p class="text-xs text-text-tertiary whitespace-nowrap">${modifiedDate}</p>
                <div class="flex items-center">
                    <button class="summarize-btn p-1.5 rounded-full hover:bg-bg-pane-dark text-text-secondary" title="Summarize Note" data-note-id="${note.id}"><i data-feather="zap" class="w-4 h-4"></i></button>
                    <button class="quiz-btn p-1.5 rounded-full hover:bg-bg-pane-dark text-text-secondary" title="Generate Quiz" data-note-id="${note.id}"><i data-feather="help-circle" class="w-4 h-4"></i></button>
                </div>
            </div>
        </div>
    `;
}).join('');
    feather.replace();
}            
            function updateEditorStats() {
                const text = app.elements.noteEditorBody.innerText || '';
                const charCount = text.length;
                const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
                app.elements.charCount.textContent = charCount;
                app.elements.wordCount.textContent = wordCount;
            }
            function createAttachmentWidgetHTML(data) {
    if (data.isImage) {
        return `<p><img src="${data.downloadURL}" alt="${data.fileName}" style="max-width: 100%; height: auto; border-radius: 8px;" contenteditable="false" /></p>`;
    } else {
        return `<div class="file-attachment-widget" contenteditable="false">
                    <i data-feather="file-text" class="w-6 h-6 text-text-secondary flex-shrink-0"></i>
                    <div class="file-info">
                        <div class="file-name">${data.fileName}</div>
                        <div class="file-size">${formatBytes(data.fileSize)}</div>
                    </div>
                    <a href="${data.downloadURL}" target="_blank" class="brand-button p-2" download title="Download ${data.fileName}"><i data-feather="download" class="w-5 h-5"></i></a>
                </div>`;
    }
}
            // =================================================================
// START: REPLACEMENT renderNoteEditor FUNCTION (FOR COLLABORATION)
// =================================================================
// notetakeapp.html

// =================================================================
// START: REPLACEMENT renderNoteEditor FUNCTION (Lazy Loading)
// =================================================================
async function renderNoteEditor() {
    app.containers.noteEditor.classList.remove('hidden');
    if (window.innerWidth < 768) {
        document.body.classList.add('mobile-editor-active');
        document.getElementById('main-header')?.classList.add('hidden');
        document.getElementById('mobile-sticky-toolbar')?.classList.remove('hidden');
    }

    const noteId = state.settings.activeNoteId;
    const noteStub = findItem(noteId)?.item;

    if (!noteStub) {
        state.settings.activeNoteId = null;
        renderMainView();
        return;
    }
    
    // This is the new "lazy loading" logic
    let noteData = window.noteCache[noteId];
    if (!noteData) {
        // If note content isn't in our cache, show a loading state...
        app.elements.noteEditorTitle.value = noteStub.name;
        app.elements.noteEditorBody.innerHTML = '<p class="text-text-tertiary">Loading content...</p>';
        
        try {
            // ...then fetch it from Firestore.
            const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
            const noteRef = doc(db, "notes", noteId);
            const noteSnap = await getDoc(noteRef);

            if (noteSnap.exists()) {
                noteData = noteSnap.data();
                window.noteCache[noteId] = noteData; // Add the loaded content to the cache
            } else {
                 // This handles the edge case of a new user clicking a default note for the first time
                const user = window.auth.currentUser;
                console.log(`Note ${noteId} not found in DB, creating it now.`);
                const now = new Date().toISOString();
                const defaultNoteContent = {
                    ownerId: user.uid, name: noteStub.name, content: '',
                    properties: {}, createdAt: now, modifiedAt: now,
                    tags: [], links: [], sharedWith: []
                };
                await setDoc(noteRef, defaultNoteContent);
                noteData = defaultNoteContent;
                window.noteCache[noteId] = noteData;
            }

        } catch (error) {
            console.error("Error fetching note content:", error);
            showToast("Could not load note.", "error");
            app.elements.noteEditorBody.innerHTML = '<p class="text-red-500">Error loading content.</p>';
            return;
        }
    }

    // Once the data is loaded (either from cache or Firestore), render it.
    const propertiesContainer = document.getElementById('note-properties-container');
    if (state.settings.propertiesVisible) {
        propertiesContainer.classList.remove('hidden');
        renderNoteProperties({ ...noteStub, ...noteData });
    } else {
        propertiesContainer.classList.add('hidden');
    }

    app.elements.noteEditorTitle.value = noteData.name;
        document.title = `${noteData.name} | Reputifly Notes`;

    app.elements.noteEditorTitle.style.height = 'auto';
    app.elements.noteEditorTitle.style.height = (app.elements.noteEditorTitle.scrollHeight) + 'px';

    // Convert any [[Note Name]] text into clickable links
const contentWithLinks = parseInternalLinks(noteData.content || '');
app.elements.noteEditorBody.innerHTML = DOMPurify.sanitize(contentWithLinks);

    renderBacklinks(noteStub, noteData); // Helper function depends on noteData
    updateEditorStats();
    listenToActiveNote(); // Activate the real-time listener
    feather.replace();
}

// Helper for renderNoteEditor
function renderBacklinks(noteStub, noteData) {
    const backlinksPane = document.getElementById('backlinks-pane');
    const backlinksList = document.getElementById('backlinks-list');

    // Ensure we have the necessary data to find links
    if (!noteData || !noteData.name) {
        backlinksPane.classList.add('hidden');
        return;
    }

    const currentNoteName = noteData.name.toLowerCase();
    const currentNoteId = noteStub.id;

    // Use the complete, cached note data to find backlinks
    const allCachedNotes = Object.entries(window.noteCache).map(([id, data]) => ({ id, ...data }));
    
    const backlinkingNotes = allCachedNotes.filter(note => 
        note.id !== currentNoteId && 
        (note.links || []).some(linkName => linkName.toLowerCase() === currentNoteName)
    );

    if (backlinkingNotes.length === 0) {
        backlinksPane.classList.add('hidden');
        return;
    }

    backlinksPane.classList.remove('hidden');

    backlinksList.innerHTML = backlinkingNotes.map(note => {
        // Find the folder name for the backlinking note
        const findResult = findItem(note.id);
        const parent = findResult ? findResult.parent : null;
        const parentName = parent && !Array.isArray(parent) ? parent.name : 'Uncategorized';
        
        const modifiedDate = formatDateTime(note.modifiedAt);
        const excerpt = note.excerpt || 'No additional context.';

        return `
            <a href="#" class="backlink-item" data-note-id="${note.id}">
                <div class="backlink-item-header">
                    <span class="note-name">${note.name}</span>
                    <span class="text-text-tertiary">|</span>
                    <span class="folder-name">${parentName}</span>
                </div>
                <p class="backlink-item-excerpt">${excerpt}</p>
                <div class="backlink-item-footer">Modified: ${modifiedDate}</div>
            </a>
        `;
    }).join('');

    renderBacklinksState(); // This function will correctly show/hide the list based on state
}
// =================================================================
// END: REPLACEMENT renderNoteEditor FUNCTION
// =================================================================
// =================================================================
// END: REPLACEMENT renderNoteEditor FUNCTION
// =================================================================
function renderNoteProperties(note) {
    const container = document.getElementById('note-properties-container');
    if (!container || !note) {
        if (container) container.innerHTML = '';
        return;
    }

    const isCollapsed = note.propertiesCollapsed;

    let headerHTML = `
        <div id="properties-header" class="flex items-center text-text-tertiary hover:text-text-primary cursor-pointer -mx-2 px-2 py-1 rounded-md hover:bg-bg-pane-dark">
            <i data-feather="chevron-right" class="w-4 h-4 transition-transform duration-200 ${!isCollapsed ? 'rotate-90' : ''}"></i>
            <span class="ml-1 text-xs font-semibold uppercase">Properties</span>
        </div>`;

    let propertiesHTML = '';
    if (!isCollapsed) {
        const defaultProps = {
            'Created': { type: 'date', value: note.createdAt, readonly: true },
            'Modified': { type: 'date', value: note.modifiedAt, readonly: true }
        };
        const allProps = { ...defaultProps, ...(note.properties || {}) };

        propertiesHTML = Object.entries(allProps).map(([name, prop]) => {
            let valueHTML = '';
            const isReadOnly = prop.readonly;
            const icons = { 'text': 'type', 'number': 'hash', 'date': 'clock', 'select': 'chevron-down', 'image': 'image' };

            switch (prop.type) {
                case 'date':
                    if (!prop.value) {
                        valueHTML = `<span class="prop-value" data-prop-name="${name}">Empty</span>`;
                        break;
                    }
                    const startDate = new Date(prop.value);
                    const endDate = prop.endValue ? new Date(prop.endValue) : null;
                    
                    const hasTime = startDate.getUTCHours() !== 0 || startDate.getUTCMinutes() !== 0 || (endDate && (endDate.getUTCHours() !== 0 || endDate.getUTCMinutes() !== 0));
                    
                    const dateOptions = { year: 'numeric', month: 'short', day: 'numeric' };
                    const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };

                    let formattedString = startDate.toLocaleString(undefined, {...dateOptions, ...(hasTime && timeOptions)});

                    if (endDate) {
                        const sameDay = startDate.toDateString() === endDate.toDateString();
                        if (sameDay) {
                            formattedString += ` → ${endDate.toLocaleTimeString(undefined, timeOptions)}`;
                        } else {
                            formattedString += ` → ${endDate.toLocaleString(undefined, {...dateOptions, ...(hasTime && timeOptions)})}`;
                        }
                    }
                    valueHTML = `<span class="prop-value" data-prop-name="${name}">${formattedString}</span>`;
                    break;
                case 'text': case 'number': case 'image': valueHTML = `<span class="prop-value" data-prop-name="${name}">${prop.value || 'Empty'}</span>`; break;
                case 'select':
                    if (prop.value) { valueHTML = `<span class="prop-value rounded px-2 py-0.5 ${getSelectColor(prop.value)}" data-prop-name="${name}">${prop.value}</span>`; } 
                    else { valueHTML = `<span class="prop-value text-text-tertiary" data-prop-name="${name}">Empty</span>`; }
                    break;
                default: valueHTML = `<span class="prop-value" data-prop-name="${name}">${prop.value || 'Empty'}</span>`;
            }

            return `<div class="property-row group flex items-center py-2 hover:bg-bg-pane-dark -mx-2 px-2 rounded-md">
                        <div class="prop-name w-32 text-text-tertiary flex-shrink-0 flex items-center gap-2 cursor-pointer">
                            <i data-feather="${icons[prop.type] || 'type'}" class="w-4 h-4"></i><span>${name}</span>
                        </div>
                        <div class="prop-value-container flex-grow text-text-primary font-medium ${isReadOnly ? '' : 'cursor-pointer'}">${valueHTML}</div>
                        ${!isReadOnly ? `<button class="delete-prop-btn opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-bg-main" data-prop-name="${name}" title="Delete Property"><i data-feather="x" class="w-4 h-4 text-text-tertiary"></i></button>` : '<div class="w-8"></div>' }
                    </div>`;
        }).join('');

        propertiesHTML += `<div class="add-property-wrapper mt-1">
                            <button id="add-property-btn" class="flex items-center gap-2 text-sm text-text-tertiary hover:text-text-primary transition-colors p-2 -mx-2 hover:bg-bg-pane-dark rounded-md w-full">
                                <i data-feather="plus" class="w-4 h-4"></i><span>Add a property</span>
                            </button>
                        </div>`;
    }

    container.innerHTML = headerHTML + propertiesHTML;
}
function renderBacklinksState() {
    const isCollapsed = state.settings.backlinksCollapsed;
    const list = document.getElementById('backlinks-list');
    const btn = document.getElementById('toggle-backlinks-btn');
    if (list && btn) {
        list.classList.toggle('collapsed', isCollapsed);
        btn.classList.toggle('collapsed', isCollapsed);
    }
}

const handleBacklinksSummary = async (currentNote, backlinkingNotes) => {
    // --- 1. Caching Logic ---
    const cacheKey = backlinkingNotes.map(n => n.id + n.modifiedAt).join('');
    if (currentNote.cachedBacklinksSummary && currentNote.cachedBacklinksSummary.key === cacheKey) {
        app.modals.summaryContent.innerHTML = currentNote.cachedBacklinksSummary.summary;
        openModal(app.modals.summary);
        document.getElementById('summary-copy-btn').classList.remove('hidden');
        feather.replace();
        showToast('Loaded summary from cache.', 'info');
        return;
    }

    // --- 2. AI Call Logic ---
    const toastId = showToast('Summarizing linked notes...', 'loading');
    const combinedContent = backlinkingNotes.map(n => `Note: ${n.name}\nContent: ${n.content.replace(/<[^>]*>?/gm, '')}`).join('\n\n---\n\n');
    const prompt = `Based on the following notes that all link to "${currentNote.name}", provide a concise summary of their collective content. Synthesize the information into a cohesive overview.

Combined Content:
---
${combinedContent}`;

    const payload = { contents: [{ parts: [{ text: prompt }] }] };
    const summaryText = await callGeminiAPI(payload);
    dismissToast(toastId);

    if (summaryText) {
        const summaryHtml = marked.parse(summaryText).trim();
        app.modals.summaryContent.innerHTML = summaryHtml;
        openModal(app.modals.summary);
        feather.replace();

        // --- 3. Save to Cache ---
        currentNote.cachedBacklinksSummary = {
            key: cacheKey,
            summary: summaryHtml
        };
        saveState();
    } else {
        showToast('Could not generate summary.', 'error');
    }
};
            
            function renderSearchResults(query) {
    app.views.searchResults.classList.remove('hidden');

    if (!query) {
        app.containers.searchResultsList.innerHTML = `<p class="text-text-secondary text-center"><i data-feather="search" class="w-12 h-12 mx-auto mb-4"></i><br>Start typing to search for notes.</p>`;
        feather.replace();
        return;
    }

    const results = lunrIndex.search(query);

    // --- FIX STARTS HERE ---
    // The original code used findItem(), which only returns a data stub without the note's content.
    // This new code correctly uses the note ID from the search result (res.ref) 
    // to get the FULL note data from the global note cache.
    const resultNotes = results.map(res => {
        const fullNoteData = window.noteCache[res.ref];
        // Combine the ID with the rest of the note data to create a complete object.
        return fullNoteData ? { id: res.ref, ...fullNoteData } : null;
    }).filter(Boolean); // Filter out any null results if a note wasn't in the cache.
    // --- FIX ENDS HERE ---

    if (resultNotes.length === 0) {
        app.containers.searchResultsList.innerHTML = `<p class="text-text-secondary text-center"><i data-feather="x-circle" class="w-12 h-12 mx-auto mb-4"></i><br>No results found for "${query}".</p>`;
        feather.replace();
        return;
    }

    const highlightText = (text, query) => {
        if (!query || !text) return text;
        const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`(${escapedQuery})`, 'gi');
        return text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(regex, `<mark>$1</mark>`);
    };

    app.containers.searchResultsList.innerHTML = resultNotes.map(note => {
        const parentResult = findItem(note.id);
        const parent = parentResult ? parentResult.parent : null;
        const parentName = parent && !Array.isArray(parent) ? parent.name : null;
        // This line now works correctly because 'note.content' is available.
        const plainContent = note.content.replace(/<[^>]*>?/gm, ''); 
        const excerpt = highlightText(plainContent, query);

        return `
            <div class="search-result-item p-4 mb-3 rounded-lg hover:shadow-md border border-border-color bg-bg-pane-light transition-shadow cursor-pointer" data-note-id="${note.id}">
                <div class="flex justify-between items-start">
                    <div class="flex-grow min-w-0">
                        <div class="font-semibold text-text-secondary text-sm">
                            ${parentName ? `${highlightText(parentName, query)} / ` : ''}<span class="text-text-primary">${highlightText(note.name, query)}</span>
                        </div>
                        <p class="text-text-secondary mt-2 truncate-multiline card-content" style="-webkit-line-clamp: 2;">${excerpt}</p>
                    </div>
                    <div class="flex items-center flex-shrink-0 ml-4">
                        <button class="summarize-btn p-2 rounded-full hover:bg-bg-pane-dark text-text-secondary" title="Summarize Note with AI" data-note-id="${note.id}">
                            <i data-feather="zap" class="w-4 h-4"></i>
                        </button>
                        <button class="quiz-btn p-2 rounded-full hover:bg-bg-pane-dark text-text-secondary" title="Generate Quiz with AI" data-note-id="${note.id}">
                            <i data-feather="help-circle" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    feather.replace();
}
            
            function renderChatHistory() {
                app.modals.chatbotHistory.innerHTML = state.chatHistory.map(msg => {
                    const bubbleClass = msg.role === 'user'
                        ? 'user'
                        : 'model';
                    const formattedHtml = marked.parse(msg.text);
                    return `
                        <div class="chat-bubble w-fit rounded-lg px-3 py-2 self-${msg.role === 'user' ? 'end' : 'start'} ${bubbleClass}">
                            ${formattedHtml}
                        </div>`;
                }).join('');
                app.modals.chatbotHistory.scrollTop = app.modals.chatbotHistory.scrollHeight;
            }
            // ADD THIS NEW HELPER FUNCTION
// REPLACE THE OLD 'upgradePastedTables' FUNCTION
// REPLACE 'upgradePastedTables' FUNCTION
const upgradePastedTables = (html) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const tables = tempDiv.querySelectorAll('table');
    if (tables.length === 0) return html;

    tables.forEach(table => {
        table.querySelectorAll('th, td').forEach(cell => cell.setAttribute('contenteditable', 'true'));
        const headers = table.querySelectorAll('th');
        const headerRow = table.querySelector('thead tr');
        const colCount = headerRow ? headerRow.children.length : 1;

        headers.forEach(th => {
            th.classList.add('sortable-header');
            th.dataset.sortDir = 'none';
        });

        const thead = table.querySelector('thead');
        if (thead) {
            const filterRow = document.createElement('tr');
            // This is the updated filter row HTML with the toggle button
            filterRow.innerHTML = `<th colspan="${colCount}" contenteditable="false"><div class="table-header-controls"><div class="table-filter-wrapper flex-grow"><i data-feather="search" class="filter-icon"></i><input class="table-filter-input" placeholder="Filter table..."/></div><button class="toggle-filter-btn" title="Toggle Filter"><i data-feather="chevrons-up" class="w-4 h-4"></i></button><button class="delete-table-btn" title="Delete Table"><i data-feather="trash-2" class="w-4 h-4"></i></button></div></th>`;
            thead.prepend(filterRow);
        }
    });
    return tempDiv.innerHTML;
};            
            // =================================================================
// START: REPLACEMENT JAVASCRIPT BLOCK
// =================================================================

/**
 * MODIFIED: Upgraded to accept a specific parentId for the new note.
 */
// =================================================================
// START: REPLACEMENT createNewNote FUNCTION
// =================================================================
// =================================================================
// START: REPLACEMENT createNewNote FUNCTION (FOR COLLABORATION)
// =================================================================
const createNewNote = async (andSwitchToIt = true, template = {}, parentId = undefined) => {
    const user = window.auth.currentUser;
    if (!user) return null;

    const { doc, collection, writeBatch, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

    let finalParentId = parentId;
    if (finalParentId === undefined) {
        finalParentId = state.settings.activeCollectionId;
    }

    const initialContent = template.content || '';
    const plainText = initialContent.replace(/<[^>]*>?/gm, ' ').trim();
    const initialExcerpt = plainText.substring(0, 200);
    const now = new Date().toISOString();

    const newNoteData = {
        ownerId: user.uid,
        name: template.name || 'Untitled Note',
        content: initialContent,
        excerpt: initialExcerpt,
        properties: template.properties ? JSON.parse(JSON.stringify(template.properties)) : {},
        createdAt: now,
        modifiedAt: now,
        tags: [],
        links: [],
        sharedWith: []
    };

    const newNoteRef = doc(collection(db, "notes"));
    const noteId = newNoteRef.id;

    const parentResult = findItem(finalParentId);
    let targetArray = state.collections;
    if (parentResult && parentResult.item.type === 'folder') {
        if (!parentResult.item.children) parentResult.item.children = [];
        targetArray = parentResult.item.children;
        parentResult.item.expanded = true;
    } else {
        finalParentId = null;
    }

    // --- THIS IS THE KANBAN FIX ---
    // Determine the initial Kanban status for the new note.
    let initialStatus = null;
    if (finalParentId && state.kanbanColumns[finalParentId] && state.kanbanColumns[finalParentId].length > 0) {
        initialStatus = state.kanbanColumns[finalParentId][0].id;
    }

    const newNoteStub = {
        id: noteId,
        type: 'note',
        name: newNoteData.name,
        excerpt: initialExcerpt,
        pinned: false,
        status: initialStatus // Assign the default status
    };
    targetArray.unshift(newNoteStub);

    // Save both the full note data and the updated folder structure
    const batch = writeBatch(db);
    batch.set(newNoteRef, newNoteData);
    window.noteCache[noteId] = newNoteData;

    const userDocRef = doc(db, "users", user.uid, "data", "appState");
    batch.update(userDocRef, { collections: state.collections });

    await batch.commit();

    if (andSwitchToIt) {
        state.settings.activeNoteId = noteId;
        state.settings.activeCollectionId = finalParentId;
        state.settings.activeTag = null;
        state.settings.editorMode = 'editor';
        await saveState();
    }

    buildLunrIndex();
    render();

    if (andSwitchToIt) {
        app.elements.noteEditorTitle.focus();
        app.elements.noteEditorTitle.select();
    }

    return { ...newNoteStub, ...newNoteData };
};
// =================================================================
// END: REPLACEMENT createNewNote FUNCTION
// =================================================================

/**
 * MODIFIED: Now generates a '+' button for each item.
 */
const renderNotionStyleMenu = () => {
    const user = window.auth.currentUser;
    if (user && user.email) {
        document.getElementById('menu-user-initial').textContent = user.email.charAt(0).toUpperCase();
        document.getElementById('menu-user-email').textContent = user.email;
        document.getElementById('dropdown-user-email-display').textContent = user.email;
    }
    const allNotes = getAllNotes(state.collections);
    const recentNotes = [...allNotes]
        .sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt))
        .slice(0, 5);
    let jumpBackHTML = '';
    if (recentNotes.length > 0) {
        jumpBackHTML = `
            <h3 class="notion-menu-section-header">Jump back in</h3>
            <div class="jump-back-in-grid">
                ${recentNotes.map(note => `
                    <a href="#" class="recent-note-card" data-id="${note.id}" data-action="navigate-note">
                        <i data-feather="file-text" class="w-5 h-5"></i>
                        <span class="note-name">${note.name}</span>
                    </a>
                `).join('')}
            </div>`;
    }

    const buildPrivateList = (collections = state.collections, level = 0, parentId = null) => {
        return collections.map(item => {
            const isFolder = item.type === 'folder';
            // --- MODIFIED: Added 'group' class and the new '+' button ---
            let itemHTML = `
                <li data-id="${item.id}" class="collection-item-wrapper group rounded-md">
                    <div class="collection-item flex items-center gap-2 p-2 rounded-md" style="padding-left: ${8 + level * 16}px;">
                        ${isFolder ? `<a href="#" class="expander-btn -ml-1 p-1" data-action="toggle-expand"><i data-feather="chevron-right" class="chevron w-4 h-4 flex-shrink-0 text-text-tertiary ${item.expanded ? 'open' : ''}"></i></a>` : '<div class="w-6 h-6 flex-shrink-0"></div>'}
                        <a href="#" class="flex items-center gap-2 flex-grow min-w-0" data-action="${isFolder ? 'navigate-folder' : 'navigate-note'}">
                            <i data-feather="${isFolder ? 'folder' : 'file-text'}" class="w-4 h-4 flex-shrink-0 text-text-secondary"></i>
                            <span class="truncate">${item.name}</span>
                        </a>
                        <button class="add-note-btn" data-action="add-note-here" data-parent-id="${isFolder ? item.id : parentId}" title="Add New Note Here">
                            <i data-feather="plus" class="w-4 h-4"></i>
                        </button>
                    </div>`;
            if (isFolder && item.expanded && item.children && item.children.length > 0) {
                itemHTML += `<ul class="collection-children">${buildPrivateList(item.children, level + 1, item.id)}</ul>`;
            } else if (isFolder && item.expanded) {
                itemHTML += `<p class="pl-12 py-1 text-sm text-text-tertiary">No notes inside</p>`;
            }
            itemHTML += `</li>`;
            return itemHTML;
        }).join('');
    };

    document.getElementById('jump-back-in-section').innerHTML = jumpBackHTML;
    document.getElementById('private-section').innerHTML = `
        <h3 class="notion-menu-section-header">All Notes</h3>
        <ul class="space-y-1">${buildPrivateList()}</ul>
    `;
    feather.replace();
};

/**
 * MODIFIED: Added a new case for 'add-note-here'.
 */
// =================================================================
// START: REPLACEMENT CLICK LISTENER
// =================================================================
// REPLACE your current notionMenu 'click' listener with this one
// REPLACE your current notionMenu 'click' listener with this one
// REPLACE your current notionMenu 'click' listener with this one

// =================================================================
// END: REPLACEMENT CLICK LISTENER
// =================================================================
// =================================================================
// END: REPLACEMENT JAVASCRIPT BLOCK
// =================================================================

            function initSpeechRecognition() {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                if (!SpeechRecognition) {
                    showToast('Speech recognition is not supported in this browser.', 'error');
                    return;
                }
                
                speechRecognizer = new SpeechRecognition();
                speechRecognizer.continuous = true;
                speechRecognizer.interimResults = false;

                speechRecognizer.onresult = (event) => {
                    const last = event.results.length - 1;
                    const text = event.results[last][0].transcript;
                    
                    app.elements.noteEditorBody.focus();
                    document.execCommand('insertText', false, text.trim() + ' ');
                    saveNoteContent();
                };

                speechRecognizer.onend = () => {
                    if (isDictating) {
                        speechRecognizer.start(); // Keep listening if it stops unexpectedly
                    }
                };
                 speechRecognizer.onerror = (event) => {
                    console.error('Speech recognition error', event.error);
                    showToast(`Speech recognition error: ${event.error}`, 'error');
                    isDictating = false;
                    app.toolbar.dictateBtn.classList.remove('recording');
                };
            }

            function initClipper() {
                if (!window.location.hash.startsWith('#clip=')) return;

                try {
                    const encodedData = window.location.hash.substring(6);
                    const data = JSON.parse(decodeURIComponent(encodedData));
                    
                    let clippedContent = `<h1>${data.title}</h1>\n<p><em>Source: <a href="${data.url}" target="_blank">${data.url}</a></em></p>\n<hr>\n<blockquote>${data.clip.replace(/\n/g, '<br>')}</blockquote>`;

                    const newNote = createNewNote(true, clippedContent);
                    showToast(`Clipped content saved to "${newNote.name}"`, 'success');

                } catch (e) {
                    console.error('Error parsing clipped data:', e);
                    showToast('Could not import clipped content.', 'error');
                } finally {
                    // Clear the hash
                    history.pushState("", document.title, window.location.pathname + window.location.search);
                }
            }
            
            function buildLunrIndex() {
    // Get all note stubs, which now contain the excerpt
    const allNoteStubs = getAllNotes(state.collections);

    lunrIndex = lunr(function () {
        this.ref('id');
        this.field('name', { boost: 10 }); // Boost titles in search results
        this.field('excerpt'); // Index the new excerpt field
        this.field('tags');

        // This now iterates through the stubs directly, without needing the full content
        allNoteStubs.forEach(noteStub => {
            this.add({
                id: noteStub.id,
                name: noteStub.name,
                excerpt: noteStub.excerpt || '', // Use the saved excerpt
                tags: (noteStub.tags || []).join(' ')
            });
        });
    });
}
function setupSharedNoteListener() {
    const user = window.auth.currentUser;
    if (!user) return;

    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")
        .then(({ collection, query, where, onSnapshot }) => {
            
            const sharedNotesQuery = query(
                collection(db, "notes"),
                where('sharedWith', 'array-contains', user.uid)
            );

            onSnapshot(sharedNotesQuery, (snapshot) => {
                let stateChanged = false;
                snapshot.docChanges().forEach((change) => {
                    const noteData = change.doc.data();
                    const noteId = change.doc.id;

                    if (change.type === "added") {
                        // --- FIX IS HERE ---
                        // Check if the note doesn't already exist in the sidebar state
                        if (!findItem(noteId)) { 
                            console.log('New shared note detected:', noteData.name);
                            window.noteCache[noteId] = noteData;
                            const noteStub = { 
                                id: noteId, 
                                name: noteData.name, 
                                type: 'note', 
                                createdAt: noteData.createdAt, 
                                modifiedAt: noteData.modifiedAt, 
                                pinned: false 
                            };
                            // Add the shared note to the root of the collections list
                            state.collections.unshift(noteStub);

                            showToast(`📬 Note shared with you: "${noteData.name}"`, 'success');
                            stateChanged = true;
                        }
                    } 
                    else if (change.type === "removed") {
                        console.log('Shared note access revoked:', noteData.name);
                        
                        delete window.noteCache[noteId];
                        const findResult = findItem(noteId);
                        
                        if (findResult) {
                            const parentArray = Array.isArray(findResult.parent) ? findResult.parent : findResult.parent.children;
                            parentArray.splice(findResult.index, 1);
                        }

                        if (state.settings.activeNoteId === noteId) {
                            state.settings.activeNoteId = null;
                        }
                        
                        showToast(`🚫 Access to "${noteData.name}" was revoked.`, 'info');
                        stateChanged = true;
                    }
                });

                if (stateChanged) {
                    saveState();
                    buildLunrIndex();
                    render();
                }
            }, (error) => {
                console.error("Error listening for shared notes:", error);
            });
        });
}
            /**
 * Renders the generated quiz data into the quiz modal.
 * @param {Array<Object>} quizArray - An array of quiz question objects.
 */
function renderQuizModal(quizArray) {
    let quizHTML = '<div class="space-y-6">';
    quizArray.forEach((q, index) => {
        const isMultiSelect = q.type === 'msq';
        // The correct answer is now stringified to be stored in the data attribute
        const correctAnswer = JSON.stringify(q.answer); 

        quizHTML += `
            <div class="quiz-question-container border-b border-border-color pb-4" data-correct-answer='${correctAnswer}' data-question-type="${q.type || 'mcq'}">
                <p class="font-semibold text-text-primary">${index + 1}. ${q.question} ${isMultiSelect ? '<span class="text-xs font-normal text-text-tertiary">(Select all that apply)</span>' : ''}</p>
                <div class="mt-3 space-y-2">
                    ${Object.entries(q.options).map(([key, value]) => `
                        <label class="block flex items-start p-2 rounded-md border border-border-color cursor-pointer hover:bg-bg-pane-dark transition-colors duration-200">
                            <input type="${isMultiSelect ? 'checkbox' : 'radio'}" name="question-${index}" value="${key}" class="mr-3 mt-1 shrink-0">
                            <span>${key}: ${value}</span>
                        </label>
                    `).join('')}
                </div>
                ${isMultiSelect ? `<button class="submit-msq-btn mt-3 px-3 py-1 text-sm brand-button rounded-md">Submit Answer</button>` : ''}
                <p class="quiz-feedback text-sm mt-2 h-5 font-medium"></p>
            </div>
        `;
    });
    quizHTML += '</div>';

    app.modals.quizContent.innerHTML = quizHTML;
    openModal(app.modals.quiz);
}

/**
 * Handles the AI call to generate an MCQ quiz from note content.
 * @param {string} noteContent - The plain text content of the note.
 */
const handleGenerateQuiz = async (noteContent, note) => {
    // Check for a valid cached quiz first.
    if (note.cachedQuiz && note.cachedQuiz.sourceModifiedAt === note.modifiedAt) {
        showToast('Loading Quiz!', 'info');
        renderQuizModal(note.cachedQuiz.data);
        return;
    }

    // NEW: Determine quiz length based on content
    const contentLength = noteContent.length;
    let numQuestions = 3;
    if (contentLength > 1000) numQuestions = 5;
    if (contentLength > 2500) numQuestions = 7;

    const toastId = showToast(`Generating quiz...`, 'loading');
    
    // NEW: Enhanced prompt for smarter, varied, and multi-select questions
    const prompt = `Based on the following text, generate a multiple-choice quiz with exactly ${numQuestions} questions.

Instructions for the AI:
1.  Create a mix of question types: some for simple fact recall, and others that test understanding of concepts, consequences, or relationships between ideas in the text.
2.  For some questions, allow for multiple correct answers (multi-select).
3.  Return the result as a single, valid JSON object with a key "quiz" which is an array of objects.
4.  Each question object MUST have four keys:
    - "question" (string): The question text.
    - "options" (object): An object with A, B, C, D keys for the options.
    - "answer" (string OR array of strings): For single-answer questions, this is a string (e.g., "A"). For multi-select questions, this is an array of strings (e.g., ["B", "D"]).
    - "type" (string): Use "mcq" for single-answer questions and "msq" for multi-select questions.
5.  Do not include any text, notes, or markdown formatting like \`\`\`json before or after the JSON object itself.

Text:
---
${noteContent}`;

    const payload = { contents: [{ parts: [{ text: prompt }] }] };
    const jsonResponse = await callGeminiAPI(payload);
    dismissToast(toastId);

    if (jsonResponse) {
        try {
            const cleanedJsonResponse = jsonResponse.replace(/^```json\n?/, '').replace(/\n?```$/, '');
            const quizData = JSON.parse(cleanedJsonResponse);

            if (quizData.quiz && Array.isArray(quizData.quiz)) {
                 renderQuizModal(quizData.quiz);
                 note.cachedQuiz = {
                     sourceModifiedAt: note.modifiedAt,
                     data: quizData.quiz
                 };
                 saveState();
            } else {
                throw new Error("Invalid quiz data structure.");
            }
        } catch (err) {
            console.error("Failed to parse quiz JSON:", err, "Raw Response:", jsonResponse);
            showToast('Failed to generate a valid quiz.', 'error');
        }
    }
};
const cleanupFontTags = () => {
    const editor = app.elements.noteEditorBody;
    const fontTags = editor.querySelectorAll('font');
    const hexToNameMap = Object.fromEntries(Object.entries(colorMap).map(([name, hex]) => [hex.toLowerCase(), name]));

    fontTags.forEach(font => {
        const colorHex = font.getAttribute('color')?.toLowerCase();
        if (!colorHex) return;

        const colorName = hexToNameMap[colorHex];

        if (colorName) {
            // If it's one of our special colors, wrap it in our custom <span>
            const span = document.createElement('span');
            span.className = `text-color-${colorName}`;
            span.dataset.textColor = colorName;
            while (font.firstChild) {
                span.appendChild(font.firstChild);
            }
            font.parentNode.replaceChild(span, font);
        } else {
            // If it's ANY OTHER color (including the default theme color), UNWRAP the <font> tag.
            // This is what removes the color styling.
            const parent = font.parentNode;
            while (font.firstChild) {
                parent.insertBefore(font.firstChild, font);
            }
            parent.removeChild(font);
            parent.normalize(); // Merges adjacent text nodes for a clean DOM
        }
    });
};
            async function init() {
                // ADD THIS ENTIRE BLOCK INSIDE THE init() FUNCTION

// Listener for the new button in the main slide-out menu
document.getElementById('mobile-menu-agents-btn').addEventListener('click', () => {
    openAgentListModal();
    closeNotionStyleMenu(); // Close the main menu after opening the agent list
});

// Listener for the "more actions" menu when a note is active
app.containers.mobileControlsDropdown.addEventListener('click', async (e) => {
    const button = e.target.closest('button[data-action="mobile-run-agent"]');
    if (button) {
        openAgentListModal();
    }
});
                const colorMap = {
    red: '#F87171',
    orange: '#FB923C',
    green: '#4ADE80',
    blue: '#60A5FA' // Note: I used the lighter blue from your toolbar for better visibility
};
                // --- START: Header Fade on Typing Logic ---
                // --- START: NEW Header Focus Mode Logic ---
// --- START: NEW Header Focus Mode Logic (Desktop Only) ---
let focusModeTimeout;
const header = document.getElementById('main-header');
const editorBody = app.elements.noteEditorBody;

// This entire feature now only runs on screen widths of 768px or more
if (window.innerWidth >= 768) {
    const showHeader = () => {
        header.classList.remove('header-focused');
    };

    const startShowHeaderTimer = () => {
        clearTimeout(focusModeTimeout);
        focusModeTimeout = setTimeout(showHeader, 1500); // Header reappears after 1.5 seconds of inactivity
    };

    const handleEditorActivity = () => {
        header.classList.add('header-focused');
        startShowHeaderTimer();
    };

    // Listen for typing or any other input in the editor
    editorBody.addEventListener('input', handleEditorActivity);

    // Also listen for scrolling within the main content area
    document.getElementById('main-content-area').addEventListener('scroll', showHeader);

    // If the user's mouse moves directly over the header, show it immediately
    header.addEventListener('mouseenter', showHeader);
}
// --- END: NEW Header Focus Mode Logic (Desktop Only) ---
// --- END: NEW Header Focus Mode Logic ---



// --- END: Header Fade on Typing Logic ---
            
                const updateSaveIndicator = () => {
    const indicator = document.getElementById('save-indicator');
    if (indicator) {
        indicator.classList.toggle('visible', isNoteDirty);
    }
};
                // --- START: Ctrl+S Manual Save Logic ---
// REPLACE WITH THIS BLOCK
// --- START: Throttled Ctrl+S Manual Save Logic ---
// REPLACE WITH THIS *IMPROVED* BLOCK
// --- START: Throttled Ctrl+S Manual Save Logic (1-Second Cooldown) ---
let isSavingManual = false; // Add a flag to prevent spamming
document.addEventListener('keydown', (e) => {
    // Check for Ctrl+S or Cmd+S
    // Check for Ctrl+S or Cmd+S
if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    if (state.settings.activeNoteId && !isSavingManual) {
        isSavingManual = true;

        // Save and then reset the "dirty" state
        performImmediateSave().then(() => {
            activeNoteCleanCopy = app.elements.noteEditorBody.innerHTML;
            isNoteDirty = false;
            updateSaveIndicator();
            showToast('✅ Saved', 'success');
        });

        setTimeout(() => {
            isSavingManual = false;
        }, 1000);
    }
}
});
// --- END: Throttled Ctrl+S Manual Save Logic (1-Second Cooldown) ---
// --- END: Throttled Ctrl+S Manual Save Logic ---
// --- END: Ctrl+S Manual Save Logic ---
                // --- START: Sharing Modal Navigation Logic ---
document.getElementById('sharing-management-modal').addEventListener('click', (e) => {
    const link = e.target.closest('.sharing-modal-note-link');
    if (link) {
        e.preventDefault();
        const noteId = link.dataset.noteId;
        if (noteId) {
            // Logic to switch to the note
            state.settings.activeNoteId = noteId;
            const { parent } = findItem(noteId);
            state.settings.activeCollectionId = (Array.isArray(parent)) ? null : parent.id;
            state.settings.activeTag = null;
            saveState();
            render();
            // Close the modal after navigating
            closeModal(document.getElementById('sharing-management-modal'));
        }
    }
});
// --- END: Sharing Modal Navigation Logic ---
                // --- START: SHARING MANAGEMENT LOGIC ---

const openSharingModal = async () => {
    const user = window.auth.currentUser;
    if (!user) return;

    const modal = document.getElementById('sharing-management-modal');
    const byMeList = document.getElementById('shared-by-me-list');
    const withMeList = document.getElementById('shared-with-me-list');
    
    byMeList.innerHTML = '<p class="text-sm text-text-tertiary p-2">Loading...</p>';
    withMeList.innerHTML = '<p class="text-sm text-text-tertiary p-2">Loading...</p>';
    openModal(modal);
    feather.replace();

    // MODIFIED: Find the note ID to prevent it from being null
    const allNotesData = Object.entries(window.noteCache).map(([id, data]) => ({ id, ...data }));
    const ownedAndSharedNotes = allNotesData.filter(note => note.ownerId === user.uid && note.sharedWith?.length > 0);
    const sharedWithUserNotes = allNotesData.filter(note => note.sharedWith?.includes(user.uid));

    // Render notes shared BY the user
    if (ownedAndSharedNotes.length === 0) {
        byMeList.innerHTML = '<p class="text-sm text-text-tertiary p-2">You are not sharing any notes.</p>';
    } else {
        const allCollaboratorUIDs = [...new Set(ownedAndSharedNotes.flatMap(note => note.sharedWith))];
        const { httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
        const getUserProfiles = httpsCallable(window.functions, 'getUserProfiles');
        const profilesResult = await getUserProfiles({ uids: allCollaboratorUIDs });
        const emailMap = new Map(profilesResult.data.users.map(u => [u.uid, u.email]));

        byMeList.innerHTML = ownedAndSharedNotes.map(note => {
            // MODIFIED: This whole block is new for better layout and clickability
            const collaboratorsHTML = note.sharedWith.map(uid => `
                <div class="text-xs text-text-secondary">${emailMap.get(uid) || 'Unknown User'}</div>
            `).join('');
            return `
                <a href="#" class="sharing-modal-note-link block p-3 bg-bg-pane-dark rounded-md hover:bg-bg-pane-light" data-note-id="${note.id}">
                    <div class="flex justify-between items-center">
                        <span class="font-semibold text-text-primary truncate">${note.name}</span>
                        <div class="flex flex-col items-end">
                            ${collaboratorsHTML}
                        </div>
                    </div>
                </a>`;
        }).join('');
    }

    // Render notes shared WITH the user
    if (sharedWithUserNotes.length === 0) {
        withMeList.innerHTML = '<p class="text-sm text-text-tertiary p-2">No notes have been shared with you.</p>';
    } else {
        const ownerUIDs = [...new Set(sharedWithUserNotes.map(note => note.ownerId))];
        if (ownerUIDs.length > 0) {
            const { httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
            const getUserProfiles = httpsCallable(window.functions, 'getUserProfiles');
            const profilesResult = await getUserProfiles({ uids: ownerUIDs });
            const ownerEmailMap = new Map(profilesResult.data.users.map(u => [u.uid, u.email]));

            // MODIFIED: This block is new for better layout and clickability
            withMeList.innerHTML = sharedWithUserNotes.map(note => `
                <a href="#" class="sharing-modal-note-link block p-3 bg-bg-pane-dark rounded-md hover:bg-bg-pane-light" data-note-id="${note.id}">
                    <div class="flex justify-between items-center">
                        <span class="font-semibold text-text-primary truncate">${note.name}</span>
                        <span class="text-xs text-text-secondary whitespace-nowrap">by ${ownerEmailMap.get(note.ownerId) || '...'}</span>
                    </div>
                </a>`
            ).join('');
        }
    }
};

document.getElementById('manage-sharing-btn').addEventListener('click', openSharingModal);
document.getElementById('sharing-modal-close-btn').addEventListener('click', () => closeModal(document.getElementById('sharing-management-modal')));
document.getElementById('sharing-modal-done-btn').addEventListener('click', () => closeModal(document.getElementById('sharing-management-modal')));



// --- END: SHARING MANAGEMENT LOGIC ---
                // --- START: NEW INVITATION LOGIC ---

const setupInvitationListener = () => {
    const user = window.auth.currentUser;
    if (!user) return;

    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js").then(({ collection, query, where, onSnapshot }) => {
        const invitationsQuery = query(
            collection(db, "invitations"),
            where('inviteeEmail', '==', user.email),
            where('status', '==', 'pending')
        );

        onSnapshot(invitationsQuery, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    showInvitationToast({ id: change.doc.id, ...change.doc.data() });
                }
                if (change.type === "removed") {
                    document.getElementById(`invite-${change.doc.id}`)?.remove();
                }
            });
        });
    });
};

const showInvitationToast = (invitation) => {
    const container = document.getElementById('invitation-toast-container');
    const toast = document.createElement('div');
    toast.id = `invite-${invitation.id}`;
    toast.className = 'bg-bg-pane-dark w-80 rounded-lg shadow-2xl p-4 border border-border-color';
    toast.innerHTML = `
        <div class="flex items-start gap-3">
            <div class="bg-gradient-to-r from-[var(--brand-grad-from)] to-[var(--brand-grad-to)] w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                ${invitation.inviterEmail.charAt(0).toUpperCase()}
            </div>
            <div class="flex-grow">
                <p class="text-sm font-semibold text-text-primary">${invitation.inviterEmail}</p>
                <p class="text-sm text-text-secondary">wants to collaborate with you on <strong>${invitation.noteName}</strong></p>
            </div>
        </div>
        <div class="flex justify-end gap-2 mt-3">
            <button data-invite-id="${invitation.id}" data-action="decline" class="px-3 py-1 text-sm rounded-md bg-bg-pane-light hover:opacity-80">Decline</button>
            <button data-invite-id="${invitation.id}" data-action="accept" class="px-3 py-1 text-sm rounded-md brand-button hover:opacity-90">Accept</button>
        </div>
    `;
    container.appendChild(toast);
};

document.getElementById('invitation-toast-container').addEventListener('click', async (e) => {
    const button = e.target.closest('button[data-invite-id]');
    if (!button) return;

    const { inviteId, action } = button.dataset;
    const toastElement = document.getElementById(`invite-${inviteId}`);

    try {
        const { httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");

        if (action === 'accept') {
            const acceptInvite = httpsCallable(functions, 'acceptInvitation');
            const result = await acceptInvite({ invitationId: inviteId });
            showToast(`🎉 You can now collaborate on "${result.data.noteName}"!`, 'success');
        } else {
            const declineInvite = httpsCallable(functions, 'declineInvitation');
            await declineInvite({ invitationId: inviteId });
            showToast('Invitation declined.', 'info');
        }

        toastElement?.remove();

    } catch (error) {
        console.error(`Failed to ${action} invitation:`, error);
        showToast(`Error: ${error.message}`, 'error');
    }
});

// --- END: NEW INVITATION LOGIC ---
                // --- START: Timer/Stopwatch Logic ---
// --- START: Timer/Stopwatch Logic ---
const initTimer = () => {
    const modal = document.getElementById('timer-modal');
    const header = document.getElementById('timer-header');
    const closeBtn = document.getElementById('timer-close-btn');
    const display = document.getElementById('timer-display');
    const startStopBtn = document.getElementById('timer-start-stop-btn');
    const resetBtn = document.getElementById('timer-reset-btn');
    const lapBtn = document.getElementById('timer-lap-btn');
    const lapsContainer = document.getElementById('timer-laps-container');
    const setBtn = document.getElementById('timer-set-btn');
    const input = document.getElementById('timer-input');
    const inputContainer = document.getElementById('timer-input-container');

    let timerInterval = null;
    let mode = 'stopwatch';
    let startTime = 0;
    let elapsedTime = 0;
    let laps = [];
    let countdownFrom = 0;
    let isRunning = false;

    const saveTimerState = () => {
        const stateToSave = {
            mode,
            startTime,
            elapsedTime,
            laps,
            countdownFrom,
            isRunning
        };
        localStorage.setItem('reputiflyTimerState', JSON.stringify(stateToSave));
    };

    const formatTime = (ms) => {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
        const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const seconds = String(totalSeconds % 60).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    };

    const updateDisplay = () => {
        let currentTotalElapsed = isRunning ? elapsedTime + (Date.now() - startTime) : elapsedTime;

        if (mode === 'stopwatch') {
            display.textContent = formatTime(currentTotalElapsed);
        } else { // Timer mode
            const remainingTime = countdownFrom - currentTotalElapsed;
            if (remainingTime <= 0 && isRunning) {
                stopTimer(); // This will update elapsedTime
                display.textContent = "00:00:00";
                showToast("⏰ Timer Finished!", "success");
                new Audio('https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3').play();
                resetTimer(); // Reset to initial state after finishing
                return;
            }
            display.textContent = formatTime(Math.max(0, remainingTime));
        }
    };

    const startTimer = () => {
        if (isRunning) return;
        isRunning = true;
        startTime = Date.now();
        timerInterval = setInterval(updateDisplay, 50); // Update more frequently for accuracy
        startStopBtn.textContent = 'Stop';
        lapBtn.disabled = (mode === 'timer');
        inputContainer.classList.add('hidden');
        saveTimerState();
    };

    const stopTimer = () => {
        if (!isRunning) return;
        clearInterval(timerInterval);
        timerInterval = null;
        elapsedTime += Date.now() - startTime;
        isRunning = false;
        startStopBtn.textContent = 'Start';
        lapBtn.disabled = true;
        saveTimerState();
    };

    const resetTimer = () => {
        stopTimer();
        elapsedTime = 0;
        laps = [];
        mode = 'stopwatch';
        countdownFrom = 0;
        isRunning = false; // Ensure isRunning is false
        display.textContent = "00:00:00";
        lapsContainer.innerHTML = '';
        inputContainer.classList.remove('hidden');
        input.value = '';
        saveTimerState();
    };

    const addLap = () => {
        if (!isRunning || mode !== 'stopwatch') return;
        const lapTime = elapsedTime + (Date.now() - startTime);
        laps.push(lapTime);
        renderLaps();
        saveTimerState();
    };
    
    const renderLaps = () => {
        lapsContainer.innerHTML = '';
        [...laps].reverse().forEach((lapTime, index) => {
            const lapNumber = laps.length - index;
            const prevLapTime = lapNumber > 1 ? laps[lapNumber - 2] : 0;
            const lapDuration = lapTime - prevLapTime;
            const lapEl = document.createElement('div');
            lapEl.className = 'flex justify-between p-1 border-b border-border-color';
            lapEl.innerHTML = `<span>Lap ${lapNumber}</span><span>${formatTime(lapDuration)}</span>`;
            lapsContainer.appendChild(lapEl);
        });
    };

    const setTimer = () => {
        const durationInMinutes = parseDurationToMinutes(input.value);
        if (durationInMinutes > 0) {
            resetTimer();
            mode = 'timer';
            countdownFrom = durationInMinutes * 60 * 1000;
            display.textContent = formatTime(countdownFrom);
            saveTimerState();
            startTimer();
        } else {
            showToast("Invalid time format. Use '15m', '1.5h', etc.", "error");
        }
    };
    
    const loadTimerState = () => {
        const savedStateJSON = localStorage.getItem('reputiflyTimerState');
        if (!savedStateJSON) return;

        const savedState = JSON.parse(savedStateJSON);
        mode = savedState.mode;
        elapsedTime = savedState.elapsedTime;
        laps = savedState.laps || [];
        countdownFrom = savedState.countdownFrom;
        
        if (savedState.isRunning) {
            // Recalculate elapsed time based on how long it's been since the page was closed
            elapsedTime += Date.now() - savedState.startTime;
            startTimer();
        }
        
        updateDisplay();
        renderLaps();
    };

    startStopBtn.addEventListener('click', () => { isRunning ? stopTimer() : startTimer(); });
    resetBtn.addEventListener('click', resetTimer);
    lapBtn.addEventListener('click', addLap);
    setBtn.addEventListener('click', setTimer);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') setTimer(); });
    closeBtn.addEventListener('click', () => closeModal(modal));

    let isDragging = false, offsetX, offsetY;
    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        offsetX = e.clientX - modal.offsetLeft;
        offsetY = e.clientY - modal.offsetTop;
        modal.style.transition = 'none';
    });
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        let newX = e.clientX - offsetX, newY = e.clientY - offsetY;
        const buffer = 10;
        newX = Math.max(buffer, Math.min(newX, window.innerWidth - modal.offsetWidth - buffer));
        newY = Math.max(buffer, Math.min(newY, window.innerHeight - modal.offsetHeight - buffer));
        modal.style.left = `${newX}px`;
        modal.style.top = `${newY}px`;
    });
    document.addEventListener('mouseup', () => {
        isDragging = false;
        modal.style.transition = 'all 0.3s';
    });

    loadTimerState();
};

// --- END: Timer/Stopwatch Logic ---
// --- END: Timer/Stopwatch Logic ---
                // Paste this code block AFTER the mainContentArea click listener
// This listener handles clicking on headers to expand/collapse them
// This listener handles clicking on headers to expand/collapse them
app.containers.notesListContent.addEventListener('click', (e) => {
    // First, check if a checklist item's label was clicked
    const itemLabel = e.target.closest('.checklist-preview-item label');
    if (itemLabel) {
        // This is the key fix: stop the click from bubbling up to the main note link.
        // We do NOT prevent the default action, as that would stop the checkbox from toggling.
        e.stopPropagation();
        return; // Action handled, nothing more to do for this click.
    }

    // Second, handle the expand/collapse header click
    const header = e.target.closest('.checklist-preview-header');
    if (header) {
        e.preventDefault();
        e.stopPropagation(); // Prevents the note link from firing
        
        const body = header.nextElementSibling;
        const chevron = header.querySelector('.feather-chevron-down');
        
        if (body && chevron) {
            const isVisible = body.style.display !== 'none';
            body.style.display = isVisible ? 'none' : 'block';
            chevron.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
        }
    }
});

// This new listener handles ticking/unticking the interactive checkboxes
// This new listener handles ticking/unticking the interactive checkboxes
// This new listener handles ticking/unticking the interactive checkboxes
// This new listener handles ticking/unticking the interactive checkboxes
app.containers.notesListContent.addEventListener('change', (e) => {
    const checkbox = e.target.closest('.checklist-preview-item input[type="checkbox"]');
    if (checkbox) {
        const { noteId, checklistIndex, itemIndex } = checkbox.dataset;
        if (!noteId) return;

        const noteResult = findItem(noteId);
        if (!noteResult || !noteResult.item) return;
        
        const note = noteResult.item;

        // 1. Update the note's content in the state using a temporary element.
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = noteData.content;

        const checklistInContent = tempDiv.querySelectorAll('.checklist-container')[parseInt(checklistIndex)];
        if (!checklistInContent) return;

        const itemInContent = checklistInContent.querySelectorAll('.checklist-item')[parseInt(itemIndex)];
        if (!itemInContent) return;

        const checkboxInContent = itemInContent.querySelector('.checklist-item-checkbox');
        const isChecked = checkbox.checked;

        itemInContent.classList.toggle('checked', isChecked);
        itemInContent.dataset.checked = isChecked;
        if (isChecked) {
            checkboxInContent.setAttribute('checked', 'checked');
        } else {
            checkboxInContent.removeAttribute('checked');
        }

        note.content = tempDiv.innerHTML;
        note.modifiedAt = new Date().toISOString();
        saveState();

        // 2. Manually update the List View UI to avoid a full re-render
        const listItemPreview = checkbox.closest('.checklist-preview-item');
        if (listItemPreview) {
            listItemPreview.classList.toggle('checked', isChecked);
        }
        
        const checklistPreviewContainer = checkbox.closest('.list-view-checklist-preview');
        if (checklistPreviewContainer) {
            const totalItems = checklistInContent.querySelectorAll('.checklist-item').length;
            const completedItems = checklistInContent.querySelectorAll('.checklist-item.checked').length;
            const progressSpan = checklistPreviewContainer.querySelector('.checklist-preview-header span.text-xs');
            if (progressSpan) {
                progressSpan.textContent = `${completedItems}/${totalItems} Done`;
            }
        }

        // 3. Manually update the main editor view if the note is currently open
        if (note.id === state.settings.activeNoteId) {
            const editorChecklists = app.elements.noteEditorBody.querySelectorAll('.checklist-container');
            const targetChecklistInEditor = editorChecklists[parseInt(checklistIndex)];
            
            if (targetChecklistInEditor) {
                // THIS IS THE FIX: We must update the live editor's DOM state
                // *before* calling the progress update function.
                const itemInEditor = targetChecklistInEditor.querySelectorAll('.checklist-item')[parseInt(itemIndex)];
                if (itemInEditor) {
                    itemInEditor.classList.toggle('checked', isChecked);
                    const checkboxInEditor = itemInEditor.querySelector('input.checklist-item-checkbox');
                    if (checkboxInEditor) {
                        checkboxInEditor.checked = isChecked;
                    }
                }
                
                // Now, update its progress bar using the corrected DOM
                updateChecklistProgress(targetChecklistInEditor);
            }
        }
    }
});
                // --- START: Calculator Logic ---
const initCalculator = () => {
    const modal = document.getElementById('calculator-modal');
    const header = document.getElementById('calculator-header');
    const closeBtn = document.getElementById('calculator-close-btn');
    const display = document.getElementById('calculator-display');
    const buttons = document.getElementById('calculator-buttons');

    let currentOperand = '';
    let previousOperand = '';
    let operation = undefined;

    const compute = () => {
        let computation;
        const prev = parseFloat(previousOperand);
        const current = parseFloat(currentOperand);
        if (isNaN(prev) || isNaN(current)) return;
        switch (operation) {
            case '+': computation = prev + current; break;
            case '-': computation = prev - current; break;
            case '*': computation = prev * current; break;
            case '/': computation = prev / current; break;
            case '%': computation = prev % current; break;
            default: return;
        }
        currentOperand = computation.toString();
        operation = undefined;
        previousOperand = '';
    };

    const chooseOperation = (op) => {
        if (currentOperand === '' && previousOperand === '') return;
        if (currentOperand === '' && previousOperand !== '') {
            operation = op;
            return;
        }
        if (previousOperand !== '') {
            compute();
        }
        operation = op;
        previousOperand = currentOperand;
        currentOperand = '';
    };

    const appendNumber = (number) => {
        if (number === '.' && currentOperand.includes('.')) return;
        currentOperand = currentOperand.toString() + number.toString();
    };
    
    const clear = () => {
        currentOperand = '';
        previousOperand = '';
        operation = undefined;
    };
    
    const clearEntry = () => {
        currentOperand = '';
    };

    const updateDisplay = () => {
        display.value = currentOperand || previousOperand || '0';
    };

    buttons.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') return;
        const buttonText = e.target.innerText;

        if (buttonText >= '0' && buttonText <= '9' || buttonText === '.') {
            appendNumber(buttonText);
        } else if (['+', '-', '*', '/', '%'].includes(buttonText)) {
            chooseOperation(buttonText);
        } else if (buttonText === '=') {
            compute();
        } else if (buttonText === 'C') {
            clear();
        } else if (buttonText === 'CE') {
            clearEntry();
        }
        updateDisplay();
    });

    display.addEventListener('keydown', (e) => {
        if ((e.key >= '0' && e.key <= '9') || e.key === '.') appendNumber(e.key);
        else if (['+', '-', '*', '/', '%'].includes(e.key)) chooseOperation(e.key);
        else if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); compute(); }
        else if (e.key === 'Backspace') clearEntry();
        else if (e.key.toLowerCase() === 'c') clear();
        else if (!['Tab', 'ArrowLeft', 'ArrowRight', 'Delete'].includes(e.key)) e.preventDefault();
        
        // A small delay to allow the value to update before displaying
        setTimeout(updateDisplay, 0);
    });

    closeBtn.addEventListener('click', () => closeModal(modal));

    // Draggable logic
    let isDragging = false;
    let offsetX, offsetY;
    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        offsetX = e.clientX - modal.offsetLeft;
        offsetY = e.clientY - modal.offsetTop;
        modal.style.transition = 'none'; // Disable transition for smooth dragging
    });
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        let newX = e.clientX - offsetX;
        let newY = e.clientY - offsetY;
        
        // Constrain movement within the viewport
        const buffer = 10;
        newX = Math.max(buffer, Math.min(newX, window.innerWidth - modal.offsetWidth - buffer));
        newY = Math.max(buffer, Math.min(newY, window.innerHeight - modal.offsetHeight - buffer));
        
        modal.style.left = `${newX}px`;
        modal.style.top = `${newY}px`;
    });
    document.addEventListener('mouseup', () => {
        isDragging = false;
        modal.style.transition = 'all 0.3s'; // Re-enable transition
    });
};

// --- END: Calculator Logic ---
                // --- START: ADD THIS ENTIRE BLOCK FOR CHATBOT CONTEXT ---
            window.chatbotContextNoteIds = []; // Use window scope to make it accessible

            const chatbotContextModal = document.getElementById('chatbot-context-modal');
            const contextNoteList = document.getElementById('chatbot-context-note-list');
            const contextPillsContainer = document.getElementById('chatbot-context-pills');

            const renderContextPills = () => {
                if (window.chatbotContextNoteIds.length === 0) {
                    contextPillsContainer.innerHTML = '';
                    return;
                }
                const allNotes = getAllNotes(state.collections);
                const contextNotes = allNotes.filter(n => window.chatbotContextNoteIds.includes(n.id));
                contextPillsContainer.innerHTML = contextNotes.map(note => `
                    <div class="bg-bg-pane-dark text-text-secondary text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
                        <i data-feather="file-text" class="w-3 h-3"></i>
                        <span>${note.name}</span>
                        <button class="remove-context-pill-btn" data-note-id="${note.id}"><i data-feather="x" class="w-3 h-3"></i></button>
                    </div>
                `).join('');
                feather.replace();
            };
            
            const renderNoteListForContext = (notesToRender, checkedIds = []) => {
    contextNoteList.innerHTML = notesToRender.map(note => `
        <label class="p-2 rounded-md hover:bg-bg-pane-dark flex items-center gap-3 cursor-pointer">
            <input type="checkbox" class="context-note-checkbox shrink-0" value="${note.id}" ${checkedIds.includes(note.id) ? 'checked' : ''}>
            <i data-feather="file-text" class="w-5 h-5 text-text-secondary flex-shrink-0"></i>
            <div class="min-w-0">
                <div class="font-semibold text-text-primary truncate">${note.name}</div>
            </div>
        </label>
    `).join('');
     feather.replace();
};
            
            document.getElementById('chatbot-add-context-btn').addEventListener('click', () => {
                renderNoteListForContext(getAllNotes(state.collections));
                openModal(chatbotContextModal);
            });

            document.getElementById('chatbot-context-search-input').addEventListener('input', (e) => {
                const query = e.target.value;
                const allNotes = getAllNotes(state.collections);
                if (!query) {
                    renderNoteListForContext(allNotes);
                    return;
                }
                const fuse = new Fuse(allNotes, { keys: ['name'], threshold: 0.4 });
                renderNoteListForContext(fuse.search(query).map(result => result.item));
            });

            document.getElementById('chatbot-context-confirm-btn').addEventListener('click', (e) => {
    const selectedIds = Array.from(contextNoteList.querySelectorAll('.context-note-checkbox:checked')).map(cb => cb.value);
    
    // Check which feature requested the notes
    if (e.currentTarget.dataset.source === 'agent') {
        agentContextNoteIds = selectedIds;
        // Render pills inside the Agent Forge modal
        const agentPillsContainer = document.getElementById('agent-context-pills');
        const allNotes = getAllNotes(state.collections);
        const contextNotes = allNotes.filter(n => agentContextNoteIds.includes(n.id));
        agentPillsContainer.innerHTML = contextNotes.map(note => `
            <div class="bg-bg-pane-dark text-text-secondary text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
                <span>${note.name}</span>
            </div>
        `).join('');
    } else {
        // Original chatbot functionality
        window.chatbotContextNoteIds = selectedIds;
        renderContextPills();
    }
    
    closeModal(chatbotContextModal);
});
            
            contextPillsContainer.addEventListener('click', (e) => {
                const removeBtn = e.target.closest('.remove-context-pill-btn');
                if(removeBtn) {
                    const noteId = removeBtn.dataset.noteId;
                    window.chatbotContextNoteIds = window.chatbotContextNoteIds.filter(id => id !== noteId);
                    renderContextPills();
                }
            });
            
            const closeContextModal = () => closeModal(chatbotContextModal);
            document.getElementById('chatbot-context-modal-close-btn').addEventListener('click', closeContextModal);
            document.getElementById('chatbot-context-cancel-btn').addEventListener('click', closeContextModal);
            // --- END: ADD THIS ENTIRE BLOCK ---
                // --- START: Calendar Right-Click to Add Event Logic ---
// --- START: Calendar Right-Click to Add Event Logic ---
// --- START: Calendar Click/Right-Click to Add Event Logic ---
// --- START: Calendar Click/Right-Click to Add Event Logic ---
// --- START: Calendar Click/Right-Click to Add Event Logic ---
const assignNoteModal = document.getElementById('assign-note-modal');
const calendarViewEl = document.getElementById('calendar-view');
let assignNoteTargetTimestamp = null;
let notesForAssignment = [];
let isAssigningWithTime = false;

const openAssignNoteModal = (timestamp, notes) => {
    assignNoteTargetTimestamp = timestamp;
    notesForAssignment = notes;
    const modalTitle = document.getElementById('assign-note-modal-title');
    const searchInput = document.getElementById('assign-note-search-input');
    const durationWrapper = document.getElementById('assign-note-duration-wrapper');
    const durationInput = document.getElementById('assign-note-duration-input');

    // A specific time is being assigned if it's not noon (our placeholder for 'all-day')
    isAssigningWithTime = !(timestamp.getHours() === 12 && timestamp.getMinutes() === 0);

    durationWrapper.style.display = isAssigningWithTime ? 'block' : 'none';
    durationInput.value = '';

    const titleTime = isAssigningWithTime ? timestamp.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
    const titleDate = timestamp.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
    modalTitle.textContent = `Assign Note to ${titleDate}${isAssigningWithTime ? ` at ${titleTime}`: ''}`;

    searchInput.value = '';
    renderAssignableNotes(notes);
    openModal(assignNoteModal);
    searchInput.focus();
};

const renderAssignableNotes = (notes) => {
    const listEl = document.getElementById('assign-note-list');
    if (notes.length === 0) {
        listEl.innerHTML = `<p class="p-4 text-center text-sm text-text-tertiary">No notes in this project.</p>`; return;
    }
    listEl.innerHTML = notes.map(note => `
        <div class="link-modal-item p-2 rounded-md hover:bg-bg-pane-dark cursor-pointer" data-note-id="${note.id}">
            <div class="flex items-center gap-3">
                <i data-feather="file-text" class="w-5 h-5 text-text-secondary flex-shrink-0"></i>
                <div class="min-w-0">
                    <div class="font-semibold text-text-primary truncate">${note.name}</div>
                    <div class="text-sm text-text-secondary truncate">${formatDateTime(note.modifiedAt)}</div>
                </div>
            </div>
        </div>`).join('');
    feather.replace();
};

const handleCalendarDayAction = (dayCell) => {
    const date = new Date(dayCell.dataset.date + 'T12:00:00');
    const collectionId = state.settings.activeCollectionId;
    const collection = findItem(collectionId)?.item;
    const notesInCollection = (collection?.children || []).filter(item => item.type === 'note');
    openAssignNoteModal(date, notesInCollection);
};

const handleDayViewTimeSlotAction = (slotEl) => {
    const dayViewContainer = slotEl.closest('.day-view-container');
    if(!dayViewContainer) return;

    const dateString = dayViewContainer.dataset.date; // This is now YYYY-MM-DD
    const allSlots = Array.from(slotEl.parentElement.children);
    const hour = allSlots.indexOf(slotEl);

    const [year, month, day] = dateString.split('-').map(Number);
    const targetTimestamp = new Date(year, month - 1, day, hour);

    const collectionId = state.settings.activeCollectionId;
    const collection = findItem(collectionId)?.item;
    const notesInCollection = (collection?.children || []).filter(item => item.type === 'note');
    openAssignNoteModal(targetTimestamp, notesInCollection);
};

calendarViewEl.addEventListener('contextmenu', (e) => {
    const dayCell = e.target.closest('.calendar-day-cell');
    const hourSlot = e.target.closest('.day-view-hour-slot');
    if (dayCell || hourSlot) e.preventDefault();

    if (dayCell) handleCalendarDayAction(dayCell);
    if (hourSlot) handleDayViewTimeSlotAction(hourSlot);
});

calendarViewEl.addEventListener('click', (e) => {
    if (window.innerWidth >= 768) return; // Mobile only
    const dayCell = e.target.closest('.calendar-day-cell');
    const hourSlot = e.target.closest('.day-view-hour-slot');
    if (dayCell || hourSlot) e.preventDefault();

    if (dayCell) handleCalendarDayAction(dayCell);
    if (hourSlot) handleDayViewTimeSlotAction(hourSlot);
});

document.getElementById('assign-note-search-input').addEventListener('input', (e) => {
    const query = e.target.value;
    if (!query) { renderAssignableNotes(notesForAssignment); return; }
    const fuse = new Fuse(notesForAssignment, { keys: ['name'], threshold: 0.4 });
    renderAssignableNotes(fuse.search(query).map(result => result.item));
});

document.getElementById('assign-note-list').addEventListener('click', (e) => {
    const noteItem = e.target.closest('.link-modal-item');
    if (noteItem) {
        const noteId = noteItem.dataset.noteId;
        const note = window.noteCache[noteId];
        if (note && assignNoteTargetTimestamp) {
            if (!note.properties) note.properties = {};

            let datePropName = Object.keys(note.properties).find(k => note.properties[k].type === 'date') || 'Date';

            note.properties[datePropName] = { type: 'date', value: assignNoteTargetTimestamp.toISOString() };

            if (isAssigningWithTime) {
                const durationInput = document.getElementById('assign-note-duration-input').value;
                let durationInMinutes = parseDurationToMinutes(durationInput);
                if (durationInMinutes <= 0) { durationInMinutes = 60; }

                const endDate = new Date(assignNoteTargetTimestamp.getTime() + durationInMinutes * 60 * 1000);
                note.properties[datePropName].endValue = endDate.toISOString();
            } else {
                delete note.properties[datePropName].endValue;
            }

            note.modifiedAt = new Date().toISOString();
            saveState();

            if (document.querySelector('.day-view-container')) {
                renderDayView(assignNoteTargetTimestamp);
            } else { renderCalendarView(); }

            closeModal(assignNoteModal);
            showToast(`✅ "${note.name}" assigned to date.`);
        }
    }
});

document.getElementById('assign-note-modal-close-btn').addEventListener('click', () => {
    closeModal(assignNoteModal);
});
// --- END: Calendar Click/Right-Click to Add Event Logic ---
// --- END: Calendar Click/Right-Click to Add Event Logic ---
// --- END: Calendar Click/Right-Click to Add Event Logic ---
// --- END: Calendar Right-Click to Add Event Logic ---
// --- END: Calendar Right-Click to Add Event Logic ---
                // --- START: Mobile Toolbar Keyboard Awareness Logic ---

// --- END: Mobile Toolbar Keyboard Awareness Logic ---
                // ADD THIS ENTIRE BLOCK FOR THE NEW "ADD PROPERTY" MODAL LOGIC
// REPLACE THE ENTIRE "ADD PROPERTY" MODAL LOGIC BLOCK WITH THIS
const addPropertyModal = document.getElementById('add-property-modal');
const propTypeSelector = document.getElementById('new-prop-type-selector');
const propValueContainer = document.getElementById('new-prop-value-container');
const propValueWrapper = document.getElementById('new-prop-value-input-wrapper');

// This function dynamically creates the correct input field based on the selected type
const renderValueInput = (type) => {
    let inputHTML = '';
    const baseClasses = "class='w-full bg-bg-pane-dark border border-border-color rounded-md p-2 focus:ring-2 focus:ring-accent-primary focus:outline-none'";

    switch (type) {
        case 'text':
            inputHTML = `<input type="text" id="new-prop-value-input" ${baseClasses}>`;
            break;
        case 'number':
            inputHTML = `<input type="number" id="new-prop-value-input" ${baseClasses}>`;
            break;
        case 'date':
            inputHTML = `<input type="date" id="new-prop-value-input" ${baseClasses}>`;
            break;
        case 'image':
            inputHTML = `<input type="text" id="new-prop-value-input" placeholder="https://example.com/image.png" ${baseClasses}>`;
            break;
        case 'select':
            // For 'select', we don't ask for an initial value, just create the property.
            propValueContainer.classList.add('hidden');
            propValueWrapper.innerHTML = '';
            return;
    }
    propValueContainer.classList.remove('hidden');
    propValueWrapper.innerHTML = inputHTML;
};

// Listen for changes on the radio buttons to show the correct input
propTypeSelector.addEventListener('change', (e) => {
    const selectedType = e.target.value;
    renderValueInput(selectedType);
});

// Logic for the "Create" button, now with value handling
document.getElementById('create-property-btn').addEventListener('click', () => {
    const nameInput = document.getElementById('new-prop-name-input');
    const errorEl = document.getElementById('add-property-error');
    const propName = nameInput.value.trim();
    const propType = addPropertyModal.querySelector('input[name="prop-type"]:checked').value;

    if (!propName) {
        errorEl.textContent = 'Property name cannot be empty.';
        return;
    }
    
    const note = findItem(state.settings.activeNoteId)?.item;
    if (note) {
        if (!note.properties) note.properties = {};
        if (note.properties[propName] || ['Created', 'Modified'].includes(propName)) {
            errorEl.textContent = 'A property with this name already exists.';
            return;
        }

        let propValue = '';
        const valueInput = document.getElementById('new-prop-value-input');
        if (valueInput) {
            propValue = valueInput.value;
            // Convert date to proper ISO string format
            if (propType === 'date' && propValue) {
                const parts = propValue.split('-');
                propValue = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).toISOString();
            }
        }

        note.properties[propName] = { type: propType, value: propValue };
        
        if (propType === 'select') {
            note.properties[propName].options = [];
        }

        saveState();
        renderNoteProperties(note);
        feather.replace();
        closeModal(addPropertyModal);
        showToast(`Property "${propName}" added!`, 'success');
    }
});

// Logic for closing the modal
const closeAddPropertyModal = () => closeModal(document.getElementById('add-property-modal'));
document.getElementById('add-property-cancel-btn').addEventListener('click', closeAddPropertyModal);
document.getElementById('add-property-modal-close-btn').addEventListener('click', closeAddPropertyModal);
// END OF BLOCK// END OF BLOCK TO ADD
                // --- START: Date Property Click-to-Calendar Listener ---
app.containers.notesListContent.addEventListener('click', (e) => {
    const dateBtn = e.target.closest('.list-view-jump-to-date-btn');
    if (dateBtn) {
        e.preventDefault();
        e.stopPropagation(); // Prevents the main card link from firing

        const noteId = dateBtn.dataset.noteId;
        const dateValue = dateBtn.dataset.dateValue;
        const noteResult = findItem(noteId);

        if (noteResult && dateValue) {
            const targetDate = new Date(dateValue);
            const parentCollection = Array.isArray(noteResult.parent) ? null : noteResult.parent;
            
            if (parentCollection) {
                // Set the calendar state for that collection to the correct month/year
                if (!state.calendar) state.calendar = {};
                state.calendar[parentCollection.id] = {
                    month: targetDate.getMonth(),
                    year: targetDate.getFullYear()
                };
                
                // Store the specific date we want to highlight
                state.settings.calendarHighlightDate = targetDate.toISOString().split('T')[0];
                
                // Switch the view to the calendar
                state.settings.activeView = 'calendar';
                state.settings.activeCollectionId = parentCollection.id;
                state.settings.activeNoteId = null; // We are viewing the folder, not a single note

                saveState();
                render();
            } else {
                showToast("Note must be in a project folder to view in calendar.", "info");
            }
        }
    }
});
// --- END: Date Property Click-to-Calendar Listener ---
                
                
                // ADD THIS NEW EVENT LISTENER INSIDE init()
// REPLACE THE ENTIRE 'calendar-view' CLICK LISTENER WITH THIS
document.getElementById('calendar-view').addEventListener('click', e => {
    const dayViewBtn = e.target.closest('#calendar-day-view-btn');
    const monthViewBtn = e.target.closest('#calendar-month-view-btn');
    const dayNumber = e.target.closest('.calendar-day-number');
    const eventLink = e.target.closest('.day-view-event-link');
    const prevBtn = e.target.closest('#calendar-prev-month');
    const nextBtn = e.target.closest('#calendar-next-month');
    const eventItem = e.target.closest('.calendar-event-item');
    
    const collectionId = state.settings.activeCollectionId;
    if (!collectionId) return;

    if (dayViewBtn) {
        renderDayView(new Date()); // Switch to today's date in Day View
    } else if (monthViewBtn) {
        renderCalendarView(); // Switch back to Month View
    } else if (dayNumber) {
        const dateStr = dayNumber.closest('.calendar-day-cell').dataset.date;
        renderDayView(new Date(dateStr + 'T12:00:00Z')); // Use noon UTC to avoid timezone issues
    } else if (eventLink) {
        e.preventDefault();
        state.settings.activeNoteId = eventLink.dataset.noteId;
        saveState();
        render();
    } else if (prevBtn) {
        state.calendar[collectionId].month--;
        if (state.calendar[collectionId].month < 0) {
            state.calendar[collectionId].month = 11;
            state.calendar[collectionId].year--;
        }
        renderCalendarView();
    } else if (nextBtn) {
        state.calendar[collectionId].month++;
        if (state.calendar[collectionId].month > 11) {
            state.calendar[collectionId].month = 0;
            state.calendar[collectionId].year++;
        }
        renderCalendarView();
    } else if (eventItem) {
        e.preventDefault();
        state.settings.activeNoteId = eventItem.dataset.noteId;
        saveState();
        render();
    }
});
// ADD THIS NEW EVENT LISTENER INSIDE init()
document.getElementById('gallery-view').addEventListener('click', e => {
    const cardItem = e.target.closest('.gallery-card-item');
    if (cardItem) {
        e.preventDefault();
        const noteId = cardItem.dataset.noteId;
        state.settings.activeNoteId = noteId;
        saveState();
        render();
    }
});
                // ADD THIS ENTIRE EVENT LISTENER BLOCK
// START: CORRECTED AND UNIFIED PROPERTY INTERACTION LOGIC
const propertiesContainer = document.getElementById('note-properties-container');
const propertiesMenu = document.getElementById('properties-menu');

// --- Unified Click Listener for the Properties Container ---
// REPLACE THE ENTIRE 'propertiesContainer.addEventListener('click', ...)' BLOCK WITH THIS
// REPLACE THE 'click' EVENT LISTENER FOR THE propertiesContainer
// REPLACE THE 'click' EVENT LISTENER FOR THE propertiesContainer
propertiesContainer.addEventListener('click', async (e) => {
    const note = findItem(state.settings.activeNoteId)?.item;
    if (!note) return;
    
    // This new block handles the "+ Add end date" button correctly, which is now legacy but we keep it for old data.
    const addEndDateBtn = e.target.closest('#add-end-date-btn');
    if (addEndDateBtn) {
        addEndDateBtn.classList.add('hidden');
        const wrapper = addEndDateBtn.closest('.flex-col')?.querySelector('#end-date-wrapper');
        if (wrapper) wrapper.classList.remove('hidden');
        return;
    }

    if (e.target.closest('#properties-header')) {
        note.propertiesCollapsed = !note.propertiesCollapsed;
        saveState();
        renderNoteProperties(note);
        feather.replace();
        return;
    }

    if (e.target.closest('#add-property-btn')) {
        const modal = document.getElementById('add-property-modal');
        document.getElementById('new-prop-name-input').value = '';
        document.getElementById('add-property-error').textContent = '';
        const defaultRadio = modal.querySelector('input[type="radio"][value="text"]');
        if(defaultRadio) defaultRadio.checked = true;
        renderValueInput('text');
        openModal(modal);
        feather.replace();
        document.getElementById('new-prop-name-input').focus();
        return;
    }

    const deleteBtn = e.target.closest('.delete-prop-btn');
    if (deleteBtn) {
        const propName = deleteBtn.dataset.propName;
        delete note.properties[propName];
        saveState();
        renderNoteProperties(note);
        feather.replace();
        return;
    }

    const valueContainer = e.target.closest('.prop-value-container');
    if (valueContainer && !valueContainer.dataset.editing) {
        const propValueEl = valueContainer.querySelector('[data-prop-name]');
        if (!propValueEl) return;

        const propName = propValueEl.dataset.propName;
        const allProps = {
            'Created': { type: 'date', value: note.createdAt, readonly: true },
            'Modified': { type: 'date', value: note.modifiedAt, readonly: true },
            ...(note.properties || {})
        };
        const prop = allProps[propName];
        if (!prop || prop.readonly) return;

        valueContainer.dataset.editing = "true";

        if (prop.type === 'date') {
            const toLocalISOString = (date) => {
                const tzoffset = (new Date()).getTimezoneOffset() * 60000;
                return (new Date(date - tzoffset)).toISOString().slice(0, 16);
            };
            
            const startValue = prop.value ? toLocalISOString(new Date(prop.value)) : '';
            let durationMinutes = 0;
            if (prop.value && prop.endValue) {
                durationMinutes = (new Date(prop.endValue) - new Date(prop.value)) / 60000;
            }
            const durationString = durationMinutes > 0 ? `${durationMinutes}m` : '';

            let inputHTML = `
                <div class="flex items-center gap-2">
                    <input type="datetime-local" value="${startValue}" class="prop-edit-input bg-transparent focus:outline-none w-full" data-prop-name="${propName}" data-prop-type="date" data-date-type="start">
                    <input type="text" value="${durationString}" placeholder="e.g., 45m, 1.5h" class="prop-edit-input bg-transparent focus:outline-none w-full" data-prop-name="${propName}" data-prop-type="date" data-date-type="duration">
                </div>
            `;
            valueContainer.innerHTML = inputHTML;
            valueContainer.querySelector('input[data-date-type="start"]')?.focus();
        } else {
            // Logic for 'text', 'number', 'select', etc. remains the same
            const originalValue = prop.value || '';
            const inputType = prop.type === 'number' ? 'number' : 'text';
            let inputHTML = `<input type="${inputType}" value="${originalValue}" class="prop-edit-input bg-transparent focus:outline-none w-full" data-prop-name="${propName}" data-prop-type="${prop.type}">`;
            valueContainer.innerHTML = inputHTML;
            const input = valueContainer.querySelector('input');
            input.focus();
            input.select();
        }
    }
});

// --- Save changes when an input loses focus (blur) ---
// --- Save changes when an input loses focus (blur) ---
// REPLACE THE 'blur' EVENT LISTENER FOR THE propertiesContainer
// REPLACE THE 'blur' EVENT LISTENER FOR THE propertiesContainer
// REPLACE THE 'blur' EVENT LISTENER FOR THE propertiesContainer
propertiesContainer.addEventListener('blur', (e) => {
    if (e.target.classList.contains('prop-edit-input')) {
        const note = findItem(state.settings.activeNoteId)?.item;
        const input = e.target;
        const propName = input.dataset.propName;
        
        if (note && propName) {
            const valueContainer = input.closest('.prop-value-container');
            if (!valueContainer) return;

            setTimeout(() => {
                if (document.activeElement.closest('.prop-value-container') === valueContainer) return;
                
                valueContainer.removeAttribute('data-editing');
                const prop = note.properties[propName];
                
                if (prop.type === 'date') {
                    const startDateInput = valueContainer.querySelector('input[data-date-type="start"]');
                    const durationInput = valueContainer.querySelector('input[data-date-type="duration"]');
                    
                    if (startDateInput && startDateInput.value) {
                        const startDate = new Date(startDateInput.value);
                        prop.value = startDate.toISOString();
                        
                        const durationMinutes = parseDurationToMinutes(durationInput.value);
                        if (durationMinutes > 0) {
                            const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
                            prop.endValue = endDate.toISOString();
                        } else {
                            delete prop.endValue;
                        }
                    } else {
                        delete prop.value;
                        delete prop.endValue;
                    }
                } else {
                    prop.value = input.value;
                }

                saveState();
                renderNoteProperties(note);
                feather.replace();
            }, 150);
        }
    }
}, true);

// --- Handle adding a new property from the menu ---
propertiesMenu.addEventListener('click', async (e) => {
    const button = e.target.closest('button');
    if (!button) return;
    const propType = button.dataset.propType;

    const propName = await showPrompt({
        title: 'New Property',
        message: `Enter a name for the new "${propType}" property:`,
        placeholder: 'e.g., Status, Priority...'
    });

    if (propName) {
        const note = findItem(state.settings.activeNoteId)?.item;
        if (note) {
            if (!note.properties) note.properties = {};
            // If the new property is a date, initialize with a valid date. Otherwise, empty string.
            const initialValue = propType === 'date' ? new Date().toISOString() : '';
            note.properties[propName] = { type: propType, value: initialValue };
            
            if (propType === 'select') {
                note.properties[propName].options = [];
            }
            saveState();
            renderNoteProperties(note);
            feather.replace();
        }
    }

    propertiesMenu.classList.add('scale-95', 'opacity-0');
    setTimeout(() => propertiesMenu.classList.add('hidden'), 100);
});
// ADD THIS ENTIRE NEW EVENT LISTENER BLOCK
document.getElementById('select-property-menu').addEventListener('click', (e) => {
    const button = e.target.closest('.select-option-item');
    if (!button) return;

    const menu = document.getElementById('select-property-menu');
    const propName = menu.dataset.propName;
    const note = findItem(state.settings.activeNoteId)?.item;
    if (!note || !propName) return;

    const prop = note.properties[propName];
    const value = button.dataset.value;
    
    // This part handles creating a new option if it doesn't exist
    if (button.dataset.action === 'create') {
        if (!prop.options) prop.options = [];
        prop.options.push({ name: value });
    }
    
    // This sets the note's property value to the selected option
    prop.value = value;
    
    saveState();
    renderNoteProperties(note);
    feather.replace();

    // Hide the menu after selection
    menu.classList.add('scale-95', 'opacity-0');
    setTimeout(() => menu.classList.add('hidden'), 100);
});
// END: CORRECTED AND UNIFIED PROPERTY INTERACTION LOGIC

// Global click to hide the properties menu
// ADD THIS NEW, UPGRADED BLOCK
// Global click listener to hide any open property-related menus
document.addEventListener('click', (e) => {
    const propertiesMenu = document.getElementById('properties-menu');
    const selectMenu = document.getElementById('select-property-menu');

    // Hide the main "Add Property" menu if clicking away
    if (!propertiesMenu.classList.contains('hidden') && !e.target.closest('#add-property-btn') && !e.target.closest('#properties-menu')) {
        propertiesMenu.classList.add('scale-95', 'opacity-0');
        setTimeout(() => propertiesMenu.classList.add('hidden'), 100);
    }

    // Hide the "Select Option" menu if clicking away from it or its trigger
    if (!selectMenu.classList.contains('hidden') && !e.target.closest('.prop-value-container') && !e.target.closest('#select-property-menu')) {
        selectMenu.classList.add('scale-95', 'opacity-0');
        setTimeout(() => selectMenu.classList.add('hidden'), 100);
    }
});
// END OF EVENT LISTENER BLOCK
                // --- START: SLASH COMMAND CONSOLE ---
                // --- START: SLASH COMMAND CONSOLE ---

// --- START: SLASH COMMAND CONSOLE ---

// --- START: SLASH COMMAND CONSOLE ---

// --- START: SLASH COMMAND CONSOLE ---
const renderTemplatesInModal = (templatesToRender) => {
    const container = document.getElementById('template-list-container');
    if (templatesToRender.length === 0) {
        container.innerHTML = `<p class="text-text-secondary text-center md:col-span-2">No templates found. Save a note as a template to get started.</p>`;
        return;
    }
    container.innerHTML = templatesToRender.map(template => `
        <div class="template-item cursor-pointer p-4 border border-border-color rounded-lg hover:bg-bg-pane-dark hover:border-accent-primary transition-all" data-template-id="${template.id}">
            <h4 class="font-semibold text-text-primary truncate">${template.name}</h4>
            <p class="text-sm text-text-secondary mt-1 truncate-multiline" style="-webkit-line-clamp: 2;">${template.content.replace(/<[^>]*>?/gm, '') || 'No content.'}</p>
        </div>
    `).join('');
};
// ADD THIS ENTIRE FUNCTION
const openTemplateModal = () => {
    const modal = document.getElementById('template-modal');
    const searchInput = document.getElementById('template-search-input');

    // Initial render with all available templates
    renderTemplatesInModal(state.templates);

    // Clear any previous search and open the modal
    searchInput.value = '';
    openModal(modal);

    // Set up a search listener for the template modal input
    const handleSearch = debounce(() => {
        const query = searchInput.value.toLowerCase().trim();
        if (!query) {
            renderTemplatesInModal(state.templates); // Show all if search is empty
            return;
        }
        const filtered = state.templates.filter(t => t.name.toLowerCase().includes(query));
        renderTemplatesInModal(filtered);
    }, 200);

    // Ensure we only add the listener once to prevent duplicates
    if (!searchInput.hasAttribute('data-listener-added')) {
        searchInput.addEventListener('input', handleSearch);
        searchInput.setAttribute('data-listener-added', 'true');
    }
};
const renderManageTemplatesModal = () => {
    const container = document.getElementById('manage-template-list');
    if (state.templates.length === 0) {
        container.innerHTML = `<p class="text-text-secondary text-center p-4">You have no saved templates.</p>`;
        return;
    }
    container.innerHTML = state.templates.map(template => `
        <div class="flex items-center justify-between p-2 bg-bg-pane-dark rounded-md" data-template-id="${template.id}">
            <span class="font-medium text-text-primary truncate">${template.name}</span>
            <div class="flex items-center gap-2">
                <button class="manage-template-rename-btn p-2 rounded-md hover:bg-bg-main text-text-secondary hover:text-accent-primary" title="Rename Template">
                    <i data-feather="edit-2" class="w-4 h-4 pointer-events-none"></i>
                </button>
                <button class="manage-template-delete-btn p-2 rounded-md hover:bg-bg-main text-text-secondary hover:text-red-500" title="Delete Template">
                    <i data-feather="trash-2" class="w-4 h-4 pointer-events-none"></i>
                </button>
            </div>
        </div>
    `).join('');
    feather.replace();
};

const renameTemplate = async (templateId) => {
    const template = state.templates.find(t => t.id === templateId);
    if (!template) return;

    const newName = await showPrompt({
        title: 'Rename Template',
        message: 'Enter a new name:',
        initialValue: template.name
    });

    if (newName && newName !== template.name) {
        template.name = newName;
        await saveState();
        renderManageTemplatesModal(); // Refresh the list
        showToast('✅ Template renamed!', 'success');
    }
};
// --- START: Collaboration & Sharing Logic ---
const openShareModal = async () => {
    const modal = document.getElementById('share-modal');
    const noteId = state.settings.activeNoteId;
    if (!noteId) return showToast('No note selected.', 'error');

    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    const noteRef = doc(db, "notes", noteId);
    const noteSnap = await getDoc(noteRef);

    if (!noteSnap.exists()) return showToast('Note not found.', 'error');

    const noteData = noteSnap.data();
    renderCollaboratorsList(noteData);
    openModal(modal);
    feather.replace();
};

// =================================================================
// START: REPLACEMENT renderCollaboratorsList FUNCTION
// =================================================================
// REPLACE THE ENTIRE renderCollaboratorsList FUNCTION
const renderCollaboratorsList = async (noteData) => {
    const listEl = document.getElementById('share-collaborators-list');
    const ownerId = noteData.ownerId;
    const sharedWithUIDs = noteData.sharedWith || [];

    const currentUserEmail = window.auth.currentUser.email;
    let html = `<div class="flex items-center justify-between p-2">
        <div class="flex items-center gap-2">
            <span class="font-medium">${currentUserEmail}</span>
            <span class="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Owner</span>
        </div>
        <span class="text-sm text-text-tertiary">Full Access</span>
    </div>`;

    if (sharedWithUIDs.length > 0) {
        try {
            // Call the new Cloud Function to get emails
            const { httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
            const getUserProfiles = httpsCallable(window.functions, 'getUserProfiles');
            const result = await getUserProfiles({ uids: sharedWithUIDs });
            const collaborators = result.data.users;

            html += collaborators.map(user => `
                <div class="flex items-center justify-between p-2 rounded-md hover:bg-bg-pane-dark">
                    <span class="text-text-primary">${user.email}</span>
                    <button class="remove-collaborator-btn text-xs text-red-500 hover:underline" data-uid="${user.uid}">Remove</button>
                </div>
            `).join('');

        } catch (error) {
            console.error("Error fetching collaborator profiles:", error);
            // Fallback to showing UIDs if the function call fails
            html += sharedWithUIDs.map(uid => `
                 <div class="flex items-center justify-between p-2 rounded-md hover:bg-bg-pane-dark">
                    <span class="font-mono text-xs text-text-secondary">Error loading email (${uid})</span>
                    <button class="remove-collaborator-btn text-xs text-red-500 hover:underline" data-uid="${uid}">Remove</button>
                </div>
            `).join('');
            showToast("Couldn't load collaborator emails.", "error");
        }
    }

    listEl.innerHTML = html;
};
// =================================================================
// END: REPLACEMENT renderCollaboratorsList FUNCTION
// =================================================================

// REPLACE the existing handleInviteCollaborator function
const handleInviteCollaborator = async () => {
    const input = document.getElementById('share-email-input');
    const errorEl = document.getElementById('share-error');
    const email = input.value.trim();
    if (!email) return;

    const noteId = state.settings.activeNoteId;
    const note = findItem(noteId)?.item;
    if (!note) return;

    errorEl.textContent = '';
    const toastId = showToast('Sending invitation...', 'loading');

    try {
        const { httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
        const inviteUser = httpsCallable(functions, 'inviteUserByEmail');

        await inviteUser({
            email: email,
            noteId: noteId,
            noteName: note.name
        });

        input.value = '';
        dismissToast(toastId);
        showToast('Invitation sent!', 'success');

    } catch (error) {
        dismissToast(toastId);
        errorEl.textContent = error.message;
        console.error("Error inviting user:", error);
    }
};
const handleRemoveCollaborator = async (uidToRemove) => {
    const noteId = state.settings.activeNoteId;
    if (!noteId || !uidToRemove) return;

    const { doc, updateDoc, getDoc, arrayRemove } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
const noteRef = doc(db, "notes", noteId);

await updateDoc(noteRef, {
    sharedWith: arrayRemove(uidToRemove)
});

    const noteSnap = await getDoc(noteRef);
    renderCollaboratorsList(noteSnap.data());
    showToast('User removed.', 'success');
};

// --- END: Collaboration & Sharing Logic ---
const deleteTemplate = async (templateId) => {
    const template = state.templates.find(t => t.id === templateId);
    if (!template) return;

    // Directly delete the template without confirmation
    state.templates = state.templates.filter(t => t.id !== templateId);
    await saveState();
    renderManageTemplatesModal(); // Refresh the list
    showToast('🗑️ Template deleted.', 'success');
};
// --- START: Real-time Note Synchronization Logic ---

// --- END: Real-time Note Synchronization Logic ---
const saveAsTemplate = async (noteStub) => {
    if (!noteStub) return showToast('❌ No note selected.', 'error');

    // --- START: FIX ---
    // This block now fetches note content from the database if it's not already loaded.
    let noteData = window.noteCache[noteStub.id];
    if (!noteData) {
        try {
            const {
                doc,
                getDoc
            } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
            const noteRef = doc(db, "notes", noteStub.id);
            const noteSnap = await getDoc(noteRef);
            if (noteSnap.exists()) {
                noteData = noteSnap.data();
                window.noteCache[noteStub.id] = noteData; // Add the loaded note to the cache
            } else {
                return showToast('❌ Note data not found in the database.', 'error');
            }
        } catch (error) {
            console.error("Error fetching note to create template:", error);
            return showToast('❌ Failed to load note content from the database.', 'error');
        }
    }
    // --- END: FIX ---

    const templateName = await showPrompt({
        title: 'Save as Template',
        message: 'Enter a name for this template:',
        initialValue: noteStub.name
    });

    if (templateName) {
        if (state.templates.some(t => t.name.toLowerCase() === templateName.toLowerCase())) {
            showToast(`❌ A template named "${templateName}" already exists.`, 'error');
            return;
        }

        const newTemplate = {
            id: generateId('template'),
            name: templateName,
            content: noteData.content,
            properties: JSON.parse(JSON.stringify(noteData.properties || {}))
        };

        state.templates.push(newTemplate);
        await saveState();
        showToast(`✅ Template "${templateName}" saved!`, 'success');
    }
};
const createContentSnippet = (content, query) => {
    const plainText = content.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ');
    const lowerQuery = query.toLowerCase();
    const queryIndex = plainText.toLowerCase().indexOf(lowerQuery);
    if (queryIndex === -1) return null;
    const start = Math.max(0, queryIndex - 20);
    const end = Math.min(plainText.length, queryIndex + query.length + 40);
    let snippet = plainText.substring(start, end);
    const regex = new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
    snippet = snippet.replace(regex, '<b class="text-accent-primary">$1</b>');
    return `...${snippet}...`;
};

const findBestMatch = (query, items) => {
    if (!query || !items || items.length === 0) return null;
    
    // These options tell Fuse.js to search by the 'name' key and to be lenient with typos.
    const fuseOptions = {
        keys: ['name'],
        includeScore: true,
        threshold: 0.4 
    };

    const fuse = new Fuse(items, fuseOptions);
    const results = fuse.search(query);
    
    // Return the best match (the first item in the results)
    return results.length > 0 ? results[0].item : null;
};

const getAllTags = () => {
    const allNotes = getAllNotes(state.collections);
    const allTagsRaw = allNotes.flatMap(note => note.tags || []);
    return [...new Set(allTagsRaw)];
};

const commandPromptContainer = document.getElementById('command-prompt-container');
const commandInput = document.getElementById('command-input');
const commandSuggestionsContainer = document.getElementById('command-suggestions');
let isCommandPromptOpen = false;
let suggestionIndex = -1;

const renderHelpModal = () => {
    const helpContent = document.getElementById('help-content');
    helpContent.innerHTML = commands.sort((a,b) => a.name.localeCompare(b.name)).map(cmd => `
        <div class="help-command-row p-2 rounded-md hover:bg-bg-pane-dark">
            <code class="font-semibold text-text-primary bg-bg-pane-dark px-2 py-1 rounded-md whitespace-nowrap">/${cmd.name}</code>
            <p class="text-sm text-text-secondary">${cmd.description}</p>
        </div>
    `).join('');
    openModal(document.getElementById('help-modal'));
    feather.replace();
};

const renderLinkedNotesModal = (note) => {
    const modalTitle = document.getElementById('linked-notes-title');
    const modalContent = document.getElementById('linked-notes-content');
    modalTitle.innerHTML = `<i data-feather="link" class="w-5 h-5 text-accent-primary"></i> Connections for "${note.name}"`;

    // --- FIX START: Use full note data from the cache ---
    const allNotes = Object.values(window.noteCache).map(data => ({ id: Object.keys(window.noteCache).find(key => window.noteCache[key] === data), ...data }));
    const currentNoteData = window.noteCache[note.id];
    
    if (!currentNoteData) {
        modalContent.innerHTML = `<p class="text-text-secondary">Note content not loaded yet. Please try again.</p>`;
        openModal(document.getElementById('linked-notes-modal'));
        feather.replace();
        return;
    }

    const outgoingLinks = (currentNoteData.links || []).map(linkName => allNotes.find(n => n.name.toLowerCase() === linkName.toLowerCase())).filter(Boolean);
    const incomingLinks = allNotes.filter(n => n.id !== currentNoteData.id && (n.links || []).some(linkName => linkName.toLowerCase() === currentNoteData.name.toLowerCase()));
    // --- FIX END ---

    const createNoteHTML = (n) => {
        const findResult = findItem(n.id);
        const parentName = (findResult && findResult.parent && !Array.isArray(findResult.parent)) ? findResult.parent.name : 'Uncategorized';

        return `
            <li class="border-2 border-border-color rounded-lg hover:bg-bg-pane-dark transition-colors duration-150">
                <a href="#" class="linked-note-jump block p-3" data-note-id="${n.id}">
                    <div class="flex items-center gap-3">
                        <i data-feather="file-text" class="w-5 h-5 text-text-secondary flex-shrink-0"></i>
                        <div class="min-w-0">
                            <div class="font-semibold text-text-primary truncate">${n.name}</div>
                            <div class="text-sm text-text-secondary truncate">${parentName}</div>
                        </div>
                    </div>
                </a>
            </li>`;
    };

    let contentHTML = '';
    if (outgoingLinks.length > 0) {
        contentHTML += `<div><h4 class="font-semibold text-text-primary mb-2">Links from this note:</h4><ul class="space-y-2">` + outgoingLinks.map(createNoteHTML).join('') + `</ul></div>`;
    }
    if (incomingLinks.length > 0) {
        contentHTML += `<div><h4 class="font-semibold text-text-primary mb-2">Linked here (Backlinks):</h4><ul class="space-y-2">` + incomingLinks.map(createNoteHTML).join('') + `</ul></div>`;
    }
    if (!contentHTML) {
        contentHTML = `<p class="text-text-secondary">No connections found for this note.</p>`;
    }

    modalContent.innerHTML = contentHTML;
    openModal(document.getElementById('linked-notes-modal'));
    feather.replace();
};

const executeWithSmartFind = async (args, itemType, action) => {
    let allItems, targetItem = null;
    if (itemType === 'notes') allItems = getAllNotes(state.collections);
    else if (itemType === 'folders') allItems = getAllFolders();
    else allItems = [...getAllNotes(state.collections), ...getAllFolders()];
    if (args) {
        targetItem = findBestMatch(args, allItems);
        if (!targetItem && itemType !== 'folders') {
            const contentResults = lunrIndex.search(args);
            if (contentResults.length > 0) {
                const item = findItem(contentResults[0].ref)?.item;
                if (item && item.type === 'note' && (itemType === 'notes' || itemType === 'items')) targetItem = item;
            }
        }
    }
    if (!targetItem) {
        if (itemType === 'notes' && state.settings.activeNoteId) targetItem = findItem(state.settings.activeNoteId)?.item;
        else if (itemType === 'folders' && state.settings.activeCollectionId) {
            const res = findItem(state.settings.activeCollectionId);
            if (res?.item.type === 'folder') targetItem = res.item;
        } else if (itemType === 'items') {
             const activeId = state.settings.activeNoteId || state.settings.activeCollectionId;
             if (activeId) targetItem = findItem(activeId)?.item;
        }
    }
    if (!targetItem) {
        const typeName = itemType.slice(0, -1);
        return showToast(`❌ ${typeName.charAt(0).toUpperCase() + typeName.slice(1)} not found.`, 'error');
    }
    action(targetItem);
};
// =================================================================
// START: AI AGENT FORGE - SESSION 1 LOGIC
// =================================================================
let agentContextNoteIds = []; // Stores IDs of notes provided as context

/**
 * The library of functions the AI agent can call. Each function is simple and atomic.
 * These are the building blocks for any agent.
 */
/**
 * Uses an AI to translate a user's simple goal into a structured list of instructions.
 */
const generateAgentInstructions = async () => {
    const guideInput = document.getElementById('agent-guide-input');
    const userGoal = guideInput.value.trim();
    if (!userGoal) return showToast('Please describe your goal for the agent.', 'error');

    const outputContainer = document.getElementById('agent-guide-output-container');
    const outputEl = document.getElementById('agent-guide-output');
    const generateBtn = document.getElementById('agent-guide-generate-btn');

    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';
    outputContainer.classList.add('hidden');

    // Create a simplified list of tools for the "guide" prompt
    const toolsForPrompt = Object.entries(agentActionLibrary).map(([name, details]) => {
        return `- ${name}: ${details.description}`;
    }).join('\n');

    const systemPrompt = `You are an expert at writing instructions for an AI agent. Your task is to convert a user's simple goal into a clear, numbered list of steps that another AI can follow.

    Here are the tools the AI agent can use:
    ${toolsForPrompt}

    Based on the user's goal, create a step-by-step instruction list. Each step should correspond to one of the available tools. Be concise and clear.

    User's Goal: "${userGoal}"

    Generated Instructions:`;

    const payload = { contents: [{ parts: [{ text: systemPrompt }] }] };
    const generatedInstructions = await callGeminiAPI(payload);

    generateBtn.disabled = false;
    generateBtn.textContent = 'Generate Instructions';

    if (generatedInstructions) {
        outputEl.textContent = generatedInstructions;
        outputContainer.classList.remove('hidden');
        feather.replace();
    } else {
        showToast('The instruction helper failed to generate a response.', 'error');
    }
};
const agentActionLibrary = {
    // In agentActionLibrary in notetakeapp.html
// Add this to your agentActionLibrary in notetakeapp.html as a fallback
// REPLACE fetchRawHTML and fetchRawHTML_frontend with this in your agentActionLibrary

    webSearch: {
        description: "Searches the web for real-time information on a given topic. Returns a list of the top 5 search result snippets as a JSON string.",
        parameters: { query: "string" },
        execute: async ({ query }) => {
            const { httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
            const searchFunction = httpsCallable(window.functions, 'webSearch');
            
            try {
                const result = await searchFunction({ query });
                // result.data.snippets is the array returned from your cloud function
                if (result.data.snippets && result.data.snippets.length > 0) {
                    // Convert the array of snippets into a string so the next AI step can read it
                    return JSON.stringify(result.data.snippets);
                } else {
                    return `No web search results found for "${query}".`;
                }
            } catch (error) {
                console.error("Error calling webSearch function:", error);
                return `An error occurred while searching the web: ${error.message}`;
            }
        }
    },
    // Add this inside agentActionLibrary in notetakeapp.html
    // TAKE NOTE THIS IS VERY HIT OR MISS RIGHT NOW IF YOU ARE TRYING TO USE FIND IMAGE, DONT USE IT FOR NOW
findImage: {
    description: "Finds a high-quality, royalty-free image URL for a given topic. Use this to find relevant images for articles.",
    parameters: { topic: "string" },
    execute: async ({ topic }) => {
        const { httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
        const findImageFunction = httpsCallable(window.functions, 'findImageForTopic');
        const result = await findImageFunction({ topic });
        const imageUrl = result.data.imageUrl;
        if (!imageUrl) return `No suitable image found for "${topic}".`;
        // Return a ready-to-use HTML image tag
        return `<img src="${imageUrl}" alt="${topic.replace(/"/g, '&quot;')}" style="max-width: 100%; height: auto; border-radius: 8px;" />`;
    }
},
    findNote: {
        description: "Finds a note by its name and returns its unique ID. Use this before reading or updating a note.",
        parameters: { noteName: "string" },
        execute: async ({ noteName }) => {
            const allNotes = getAllNotes(state.collections);
            const targetNote = findBestMatch(noteName, allNotes);
            if (!targetNote) throw new Error(`Note named '${noteName}' could not be found.`);
            return targetNote.id;
        }
    },
    // Inside the agentActionLibrary object...

    // REPLACE the old fetchWebsiteContent function with this one.
    // REPLACE your old 'fetchWebsiteContent' with this upgraded version
fetchWebsiteContent: {
    description: "Fetches and parses the main article content from a URL into clean Markdown, removing ads and boilerplate.",
    parameters: { url: "string" },
    execute: async ({ url }) => {
        const { httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
        // This calls the 'getArticleContent' backend function
        const getArticle = httpsCallable(window.functions, 'getArticleContent');
        const result = await getArticle({ url });
        return result.data.markdownContent;
    }
},

    // ... your other functions like promptAI, createNewNote, etc.
    readNote: {
        description: "Reads the full content of a note using its ID. Use this after 'findNote' to get the text needed for other AI actions.",
        parameters: { noteId: "string" },
        execute: async ({ noteId }) => {
            let noteData = window.noteCache[noteId];
            if (!noteData) {
                // If not in cache, try to load it from Firestore
                try {
                    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
                    const noteRef = doc(db, "notes", noteId);
                    const noteSnap = await getDoc(noteRef);
                    if (noteSnap.exists()) {
                        noteData = noteSnap.data();
                        window.noteCache[noteId] = noteData; // Add to cache for future use
                    } else {
                        throw new Error(`Note with ID ${noteId} does not exist.`);
                    }
                } catch (e) {
                    throw new Error(`Failed to load note with ID ${noteId} from database.`);
                }
            }
            // Return just the plain text content for the AI to process
            return (noteData.content || '').replace(/<[^>]*>?/gm, ' ').trim();
        }
    },
    updateNote: {
    description: "Updates the content of an existing note. You can append, prepend, or replace the content.",
    parameters: { noteId: "string", content: "string", mode: "'append' | 'prepend' | 'replace'" },
    execute: async ({ noteId, content, mode }) => {
        const noteData = window.noteCache[noteId];
        if (!noteData) throw new Error(`Note with ID ${noteId} not found in cache. It may need to be loaded first.`);

        // Convert provided markdown content to HTML and SANITIZE it before saving
        const contentHtml = DOMPurify.sanitize(marked.parse(content || ''));

        switch(mode) {
            case 'append':
                noteData.content += contentHtml;
                break;
            case 'prepend':
                noteData.content = contentHtml + noteData.content;
                break;
            case 'replace':
                noteData.content = contentHtml;
                break;
            default:
                throw new Error(`Invalid mode: ${mode}. Use 'append', 'prepend', or 'replace'.`);
        }
        noteData.modifiedAt = new Date().toISOString();

        await saveSpecificNoteToFirestore(noteId, noteData);
        return `Note ID ${noteId} content has been updated.`;
    }
},
    askUser: {
        description: "Pauses the agent and asks the user for a text input. Returns the user's response.",
        parameters: { prompt: "string" },
        execute: async ({ prompt }) => {
            const userInput = await showPrompt({
                title: 'Agent Needs Input',
                message: prompt
            });
            if (userInput === null) throw new Error("User cancelled the operation.");
            return userInput;
        }
    },
    researchAI: {
        description: "Uses the AI's internal knowledge and search capabilities to research a topic and return a comprehensive summary. Ideal for public information, current events, or general knowledge questions.",
        parameters: { topic: "string" },
        execute: async ({ topic }) => {
            const researchPrompt = `As a research assistant, provide a well-written, comprehensive summary on the following topic. Use your internal knowledge and search capabilities to gather up-to-date information. Format your response in clean markdown.\n\nTopic: "${topic}"`;
            const payload = { contents: [{ parts: [{ text: researchPrompt }] }] };
            const response = await callGeminiAPI(payload);
            return response || "The AI could not find information on that topic.";
        }
    },
    createNewNote: {
    description: "Creates a new note. Returns the ID of the new note.",
    parameters: { name: "string", content: "string", parentId: "string (optional)", switchToIt: "boolean (optional, default: false)" },
    execute: async ({ name, content, parentId, switchToIt = false }) => {
        // We now pass the 'switchToIt' variable to the core createNewNote function
        const newNote = await createNewNote(switchToIt, { name, content }, parentId);
        if (!window.noteCache[newNote.id]) {
             window.noteCache[newNote.id] = newNote;
        }
        // Add a flag to the note stub to mark it as AI-generated
        const noteStub = findItem(newNote.id)?.item;
        if (noteStub) {
            noteStub.isAiGenerated = true;
        }
        return newNote.id;
    }
},
    promptAI: {
        description: "Sends a prompt to a general-purpose AI and returns the text response. Use this for content generation, summarization, etc, based on text you provide in the prompt itself.",
        parameters: { prompt: "string" },
        execute: async ({ prompt }) => {
            const payload = { contents: [{ parts: [{ text: prompt }] }] };
            const response = await callGeminiAPI(payload);
            return response;
        }
    },
    // ADD THIS NEW, ERROR-FREE FUNCTION to your agentActionLibrary

formatMarkdown: {
    description: "Converts a string of Markdown text into clean, safe HTML. Use this as the final step before creating or updating a note with AI-generated content to ensure proper formatting and prevent errors.",
    parameters: { markdownText: "string" },
    execute: async ({ markdownText }) => {
        if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
            throw new Error("Required libraries (marked.js or DOMPurify) are not loaded.");
        }
        // Step 1: Convert the AI's potentially imperfect Markdown into standard HTML.
        const rawHtml = marked.parse(markdownText || '');
        
        // Step 2: Sanitize the HTML to remove any potential errors or malicious code. This is crucial for security.
        const cleanHtml = DOMPurify.sanitize(rawHtml);
        
        return cleanHtml;
    }
},
    
};
/**
 * The "Master AI" prompt that translates natural language into a JSON plan.
 * This is the core intelligence of the Agent Forge.
 */
const getAgentSystemPrompt = (userInstructions, noteContext) => {
    // This part dynamically creates a list of all available tools for the AI.
    const tools = Object.entries(agentActionLibrary).map(([name, details]) => {
        return `
    - Function Name: "${name}"
      Description: ${details.description}
      Parameters: ${JSON.stringify(details.parameters)}
    `;
    }).join('');

    // This part formats any context notes you provide to the agent.
    let contextText = '';
    if (noteContext) {
        contextText = `
The user has provided the following notes as context. Use their content to inform your actions. Do not modify these notes unless explicitly told to.
--- CONTEXT START ---
${noteContext}
--- CONTEXT END ---
`;
    }

    // This is the main prompt that tells the "Master AI" how to behave.
    return `You are an expert task decomposer. Your job is to convert a user's high-level instructions into a sequence of precise function calls.

You have access to the following tools:
${tools}

Analyze the user's instructions and the provided context. Break down the request into a logical sequence of steps. For each step, identify the correct function and determine its parameters.

CRITICAL INSTRUCTIONS:
- To act on an existing note (like updating it, adding a tag, etc.), you **MUST** first use the \`findNote\` function to get its ID.
- Use placeholders like \`{step1.output}\` to pass the result of one step to a later step. For example, the ID from \`findNote\` can be used in \`updateNote\`.
- For any questions about public information, current events, or topics not found in the user's notes, use the **\`researchAI\`** action. Its output is a ready-to-use summary.
- The \`askUser\` function is for when you need more information from the user to complete a task.
- When using the \`promptAI\` function to generate content for a note, ALWAYS format the output using clean and readable Markdown.

User Instructions:
"${userInstructions}"

${contextText}
Return your plan as a single, valid JSON object containing a "plan" key, which is an array of step objects. Each step object must have "step", "function", "parameters", and "description" keys. Do not include any text or markdown formatting outside of the JSON object.`;
};

/**
 * The "Agent Runner" that executes the plan generated by the Master AI.
 */
const runAgentPlan = async (plan) => {
    const logEl = document.getElementById('agent-forge-logs');
    logEl.innerHTML = ''; // Clear previous logs
    const log = (message) => {
        let styledMessage = message.replace(/</g, "&lt;");
        if (styledMessage.startsWith('[Step')) {
            styledMessage = `<span class="log-step">${styledMessage}</span>`;
        } else if (styledMessage.startsWith('  > Success!')) {
            styledMessage = `<span class="log-success">${styledMessage}</span>`;
        } else if (styledMessage.startsWith('  > Resolved placeholder')) {
            styledMessage = `<span class="log-resolved">${styledMessage}</span>`;
        } else if (styledMessage.includes('[ERROR]')) {
            styledMessage = `<span class="log-error">${styledMessage}</span>`;
        }
        logEl.innerHTML += `<div>${styledMessage}</div>`;
        logEl.scrollTop = logEl.scrollHeight;
    };

    const context = {}; // Stores outputs from previous steps

    for (const step of plan) {
        try {
            log(`[Step ${step.step}] Running: ${step.function}...`);

            // Resolve placeholders like "{step1.output}"
            // --- START: CORRECTED PLACEHOLDER SUBSTITUTION LOGIC ---
            // This new logic correctly finds and replaces placeholders inside larger strings.
            const resolvedParams = {};
            for (const key in step.parameters) {
                let value = step.parameters[key];
                if (typeof value === 'string') {
                    // Use regex to find all instances of {key.name}
                    value = value.replace(/{([^}]+)}/g, (match, contextKey) => {
                        if (context.hasOwnProperty(contextKey)) {
                            log(`  > Resolved placeholder '${match}' for param '${key}'`);
                            // Return the value from context, ensuring it's a string
                            return String(context[contextKey]); 
                        }
                        // If the key is not in context, return the original placeholder
                        log(`  > [WARN] Could not resolve placeholder '${match}'`);
                        return match; 
                    });
                }
                resolvedParams[key] = value;
            }
            // --- END: CORRECTED PLACEHOLDER SUBSTITUTION LOGIC ---

            // Find and execute the corresponding function from our library
            const action = agentActionLibrary[step.function];
            if (!action) throw new Error(`Function "${step.function}" not found in library.`);

            const output = await action.execute(resolvedParams);
            context[`step${step.step}.output`] = output;
            log(`  > Success! Output: ${output ? JSON.stringify(output) : 'None'}`);

        } catch (error) {
            log(`  <span class="text-red-500">> [ERROR] Step ${step.step} failed: ${error.message}</span>`);
            return; // Stop execution on failure
        }
    }

    log(`[Agent] Plan executed successfully.`);
    
    buildLunrIndex();
    render(); // Update the UI to reflect changes
};
// ADD THESE FOUR NEW FUNCTIONS

const handleExportAgent = (agentId) => {
    const agent = state.agents.find(a => a.id === agentId);
    if (!agent) return showToast('Agent not found.', 'error');

    const allNotes = getAllNotes(state.collections);
    const contextNoteNames = (agent.contextNoteIds || [])
        .map(id => allNotes.find(n => n.id === id)?.name)
        .filter(Boolean); // Filters out names of deleted notes

    const exportData = {
        format: "reputifly-agent",
        version: "1.0",
        agent: {
            name: agent.name,
            trigger: agent.trigger,
            argumentName: agent.argumentName,
            instructions: agent.instructions,
            contextNoteNames: contextNoteNames
        }
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${agent.trigger}-agent.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exporting agent "${agent.name}"...`, 'success');
};

const handleImportAgent = (file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const importedData = JSON.parse(event.target.result);
            if (importedData.format !== 'reputifly-agent' || importedData.version !== '1.0') {
                throw new Error('Invalid agent file format.');
            }
            openAgentRemappingModal(importedData.agent);
        } catch (err) {
            showToast(`Import failed: ${err.message}`, 'error');
        }
    };
    reader.readAsText(file);
};

const openAgentRemappingModal = (agentData) => {
    const modal = document.getElementById('agent-remap-modal');
    const contentEl = document.getElementById('agent-remap-content');
    const titleEl = document.getElementById('agent-remap-title');

    titleEl.querySelector('span').textContent = `Import Agent: "${agentData.name}"`;

    const contextNoteNames = agentData.contextNoteNames || [];
    if (contextNoteNames.length === 0) {
        contentEl.innerHTML = `<p class="text-text-secondary">This agent does not require any specific context notes. Ready to import?</p>`;
    } else {
        const allUserNotes = getAllNotes(state.collections);
        const optionsHTML = allUserNotes.map(note => `<option value="${note.id}">${note.name}</option>`).join('');
        contentEl.innerHTML = `
            <p class="text-sm text-text-secondary">This agent needs the following notes for context. Please map them to your existing notes.</p>
            <div class="space-y-4 mt-4">
            ${contextNoteNames.map((name, index) => `
                <div>
                    <label class="font-semibold text-text-primary">Required: "${name}"</label>
                    <select class="agent-remap-select w-full mt-1" data-original-name="${name}" data-index="${index}">
                        <option value="">Select one of your notes...</option>
                        ${optionsHTML}
                    </select>
                </div>
            `).join('')}
            </div>
        `;
    }

    modal.dataset.agentData = JSON.stringify(agentData);
    openModal(modal);
    feather.replace();
};

const handleConfirmAgentImport = async () => {
    const modal = document.getElementById('agent-remap-modal');
    const agentData = JSON.parse(modal.dataset.agentData);
    const selects = modal.querySelectorAll('.agent-remap-select');
    const newContextNoteIds = [];
    let isMappingComplete = true;

    selects.forEach(select => {
        if (select.value) {
            newContextNoteIds.push(select.value);
        } else {
            isMappingComplete = false;
        }
    });

    if (!isMappingComplete) {
        return showToast('Please map all required context notes.', 'error');
    }

    let agentName = agentData.name;
    let agentTrigger = agentData.trigger;

    if (state.agents.some(a => a.trigger === agentTrigger)) {
        showToast(`Command "/run ${agentTrigger}" already exists. Renaming imported agent.`, 'info');
        agentName = `${agentName} (Imported)`;
        agentTrigger = `${agentTrigger}-imported`;
    }

    const newAgent = {
        id: generateId('agent'),
        name: agentName,
        trigger: agentTrigger,
        argumentName: agentData.argumentName,
        instructions: agentData.instructions,
        contextNoteIds: newContextNoteIds
    };

    state.agents.push(newAgent);
    await saveState();

    renderAgentList();
    closeModal(modal);
    showToast(`Agent "${newAgent.name}" imported successfully!`, 'success');
};
/**
 * Main function to kick off the agent creation and execution process.
 */
const handleRunAgent = async (agent, argument = '') => {
    // If called without an agent (e.g., from the "Execute" button), get the current UI state.
    let instructions;
    if (agent) {
        instructions = agent.instructions;
        agentContextNoteIds = agent.contextNoteIds || [];
    } else {
        instructions = document.getElementById('agent-instructions-input').value.trim();
        // agentContextNoteIds is already set from the UI
    }

    if (!instructions) return showToast('Agent instructions cannot be empty.', 'error');
    
    // --- THIS IS THE NEW LOGIC ---
    // If the agent has a defined argument placeholder and the user provided an argument,
    // replace the placeholder in the instructions.
    if (agent && agent.argumentName && argument) {
        instructions = instructions.replaceAll(agent.argumentName, argument);
    }
    // --- END NEW LOGIC ---
    
    // Pre-fill the UI and open the Forge modal to show the process
    document.getElementById('agent-instructions-input').value = instructions;
    const forgeModal = document.getElementById('agent-forge-modal');
    openModal(forgeModal);

    const logEl = document.getElementById('agent-forge-logs');
    logEl.innerHTML = '🧠 Agent Forge is thinking...';

    // Prepare context from selected notes
    let noteContext = '';
    if (agentContextNoteIds.length > 0) {
        await ensureAllNotesLoaded(agentContextNoteIds);
        noteContext = agentContextNoteIds.map(id => {
            const noteData = window.noteCache[id];
            const plainContent = (noteData.content || '').replace(/<[^>]*>?/gm, '');
            return `Note Name: "${noteData.name}"\nNote ID: "${id}"\nContent:\n${plainContent}`;
        }).join('\n\n---\n\n');
    }

    const systemPrompt = getAgentSystemPrompt(instructions, noteContext);
    const payload = { contents: [{ parts: [{ text: systemPrompt }] }] };

    const rawResponse = await callGeminiAPI(payload);

    if (rawResponse) {
        try {
            const jsonString = rawResponse.match(/{[\s\S]*}/)[0];
            const responseJson = JSON.parse(jsonString);
            if (responseJson.plan) {
                logEl.innerHTML = '✅ Plan received from AI. Starting execution...';
                await runAgentPlan(responseJson.plan);
                // The modal now closes automatically after successful execution
                setTimeout(() => closeModal(forgeModal), 2000); 
            } else {
                throw new Error("AI response did not contain a 'plan' key.");
            }
        } catch (err) {
            console.error("Failed to parse agent plan:", err, "Raw Response:", rawResponse);
            logEl.innerHTML = `<span class="text-red-500">Error: Could not understand the AI's plan.</span>`;
        }
    } else {
        logEl.innerHTML = `<span class="text-red-500">Error: The Master AI did not respond.</span>`;
    }
};

// This helper is used to load notes that are provided as context to the agent
const ensureAllNotesLoaded = async (noteIds) => {
    const notesToLoad = noteIds.filter(id => !window.noteCache[id]);
    if (notesToLoad.length === 0) return true; // Early exit if no notes to load

    try {
        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        const fetchPromises = notesToLoad.map(id => getDoc(doc(db, "notes", id)).then(snap => {
            if (snap.exists()) window.noteCache[id] = snap.data();
        }));
        await Promise.all(fetchPromises);
        return true; // Return true on success
    } catch (error) {
        console.error("Error loading agent context notes:", error);
        showToast("Failed to load context notes.", "error");
        return false; // Return false on error
    }
};

/**
 * Sets up event listeners for the Agent Forge modal.
 */
/**
 * Sets up event listeners for the Agent Forge modal, including dragging.
 */
/**
 * Sets up event listeners for the Agent Forge modal, including the new Step Builder.
 */
const initAgentForgeListeners = () => {
    const modal = document.getElementById('agent-forge-modal');
    const header = modal.querySelector('header');
    
    // --- START: Agent Forge Tab Switching Logic (Updated for 3 tabs) ---
    const tabsContainer = document.getElementById('agent-forge-tabs');
    if (tabsContainer) {
        tabsContainer.addEventListener('click', (e) => {
            const button = e.target.closest('.forge-tab-btn');
            if (!button) return;

            tabsContainer.querySelectorAll('.forge-tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.forge-tab-content').forEach(content => content.classList.remove('active'));

            const tabName = button.dataset.tab;
            button.classList.add('active');
            document.getElementById(`tab-${tabName}`).classList.add('active');
        });
    }

    // --- START: NEW STEP BUILDER LOGIC ---
    const stepContainer = document.getElementById('agent-step-container');
    const placeholder = document.getElementById('agent-step-placeholder');
    let stepCounter = 0;

    // Initialize SortableJS for drag-and-drop
    new Sortable(stepContainer, {
        animation: 150,
        handle: '.agent-step-card',
        ghostClass: 'dragging',
        onEnd: () => updateStepNumbers()
    });

    const updateStepNumbers = () => {
        const steps = stepContainer.querySelectorAll('.agent-step-card');
        steps.forEach((step, index) => {
            step.dataset.stepIndex = index + 1;
            step.querySelector('.step-number').textContent = index + 1;
        });
        placeholder.style.display = steps.length === 0 ? 'block' : 'none';
    };

    const createParameterInput = (paramName, paramType, stepIndex) => {
        const details = agentActionLibrary[paramType]?.parameters[paramName];
        let inputHTML = '';
        let helpText = '';

        if (paramName === 'mode' && paramType === 'updateNote') {
            inputHTML = `
                <select class="param-input" data-param-name="${paramName}">
                    <option value="append">Append</option>
                    <option value="prepend">Prepend</option>
                    <option value="replace">Replace</option>
                </select>
            `;
            helpText = 'How to modify the note content.';
        } else {
            inputHTML = `
                <div class="param-input-wrapper">
                    <input type="text" class="param-input" data-param-name="${paramName}" placeholder="Enter value or use output...">
                    <button class="param-output-btn" title="Use output from a previous step"><i data-feather="database" class="w-4 h-4 pointer-events-none"></i></button>
                </div>`;
            helpText = `e.g., A note name like "My Meeting Notes"`;
        }
        
        return `
            <div class="agent-step-param">
                <label>${paramName}</label>
                ${inputHTML}
                ${helpText ? `<p class="param-help-text">${helpText}</p>` : ''}
            </div>
        `;
    };

    const updateStepBody = (stepCard, actionName) => {
        const body = stepCard.querySelector('.agent-step-body');
        const action = agentActionLibrary[actionName];
        if (!action) {
            body.innerHTML = '<p class="text-sm text-text-tertiary px-3">Select an action to configure its parameters.</p>';
            return;
        }

        const stepIndex = parseInt(stepCard.dataset.stepIndex, 10);
        let paramsHTML = `<p class="text-sm text-text-tertiary px-3 pb-2">${action.description}</p>`;
        paramsHTML += Object.keys(action.parameters).map(paramName => createParameterInput(paramName, actionName, stepIndex)).join('');
        body.innerHTML = paramsHTML;
        feather.replace();
    };

    document.getElementById('agent-add-step-btn').addEventListener('click', () => {
        stepCounter++;
        const newStep = document.createElement('div');
        newStep.className = 'agent-step-card';
        newStep.dataset.stepIndex = stepContainer.children.length; // Will be updated by updateStepNumbers

        const actionOptions = Object.keys(agentActionLibrary).map(key => `<option value="${key}">${key}</option>`).join('');
        
        newStep.innerHTML = `
            <div class="agent-step-header">
                <div class="agent-step-title">
                    <span class="step-number"></span>
                    <select class="agent-action-select bg-transparent font-semibold border-0 focus:ring-0 p-1">
                        <option value="">Select Action...</option>
                        ${actionOptions}
                    </select>
                </div>
                <button class="agent-delete-step-btn p-1 rounded-full hover:bg-bg-main text-text-tertiary hover:text-red-500">
                    <i data-feather="x" class="w-4 h-4 pointer-events-none"></i>
                </button>
            </div>
            <div class="agent-step-body mt-2">
                 <p class="text-sm text-text-tertiary px-3">Select an action to see its options.</p>
            </div>
        `;
        stepContainer.appendChild(newStep);
        updateStepNumbers();
        feather.replace();
    });

    stepContainer.addEventListener('change', (e) => {
        if (e.target.classList.contains('agent-action-select')) {
            const stepCard = e.target.closest('.agent-step-card');
            updateStepBody(stepCard, e.target.value);
        }
    });

    stepContainer.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.agent-delete-step-btn');
        if (deleteBtn) {
            deleteBtn.closest('.agent-step-card').remove();
            updateStepNumbers();
        }

        const outputBtn = e.target.closest('.param-output-btn');
        if (outputBtn) {
            const currentStepIndex = parseInt(outputBtn.closest('.agent-step-card').dataset.stepIndex, 10);
            const inputWrapper = outputBtn.closest('.param-input-wrapper');
            const existingMenu = inputWrapper.querySelector('.param-output-menu');
            if (existingMenu) {
                existingMenu.remove();
                return;
            }

            let menuHTML = '';
            for (let i = 1; i < currentStepIndex; i++) {
                menuHTML += `<div class="param-output-item cursor-pointer" data-value="{step${i}.output}">Output of Step ${i}</div>`;
            }

            if (menuHTML) {
                const menu = document.createElement('div');
                menu.className = 'param-output-menu';
                menu.innerHTML = menuHTML;
                inputWrapper.appendChild(menu);
            }
        }

        const outputItem = e.target.closest('.param-output-item');
        if (outputItem) {
            const input = outputItem.closest('.param-input-wrapper').querySelector('input');
            input.value = outputItem.dataset.value;
            outputItem.closest('.param-output-menu').remove();
        }
    });

    document.getElementById('agent-generate-from-steps-btn').addEventListener('click', () => {
        const steps = stepContainer.querySelectorAll('.agent-step-card');
        const agentGoal = document.getElementById('agent-goal-input').value.trim();

        if (!agentGoal) {
            showToast('Please define the agent\'s overall goal first.', 'info');
            document.getElementById('agent-goal-input').focus();
            return;
        }

        if (steps.length === 0) {
            showToast('Add at least one step to generate instructions.', 'info');
            return;
        }

        // --- START: UPGRADED PROMPT LOGIC ---

        // 1. Construct the structured list of steps (as before).
        const structuredSteps = Array.from(steps).map((step, index) => {
            const action = step.querySelector('.agent-action-select').value;
            if (!action) return null; // Skip empty steps

            const params = Array.from(step.querySelectorAll('.param-input')).map(input => {
                const paramName = input.dataset.paramName;
                const paramValue = input.value.replace(/"/g, '\\"'); // Escape quotes
                return `${paramName}: "${paramValue}"`;
            }).join(', ');

            return `${index + 1}. Execute the action "${action}" with the following details: ${params}.`;
        }).filter(Boolean).join('\n'); // Filter out nulls and join

        if (!structuredSteps) {
            showToast('Please select an action for each step.', 'info');
            return;
        }

        // 2. Combine the high-level goal and the structured steps into a single, powerful prompt.
        const finalPromptForHelper = `
Please generate a clear, numbered list of instructions for an AI agent.

**Overall Goal:** ${agentGoal}

**Structured Plan:**
${structuredSteps}

Based on the goal and plan above, create the final instructions. Make sure to handle placeholders like {{competitor_name}} correctly and apply them to all relevant steps. The output should be a simple, numbered list that the agent can execute directly.
        `;

        // 3. Populate the Instruction Helper with this new, comprehensive prompt.
        document.getElementById('agent-guide-input').value = finalPromptForHelper.trim();
        showToast('Comprehensive prompt generated!', 'success');
        
        // --- END: UPGRADED PROMPT LOGIC ---
        
        // Switch to the helper tab and auto-generate
        tabsContainer.querySelector('[data-tab="helper"]').click();
        document.getElementById('agent-guide-generate-btn').click();
    });

    // Original listeners
    document.getElementById('agent-guide-generate-btn').addEventListener('click', generateAgentInstructions);
    document.getElementById('agent-guide-use-btn').addEventListener('click', () => {
        const generatedText = document.getElementById('agent-guide-output').textContent;
        const mainInstructionsInput = document.getElementById('agent-instructions-input');
        mainInstructionsInput.value = generatedText;
        mainInstructionsInput.dispatchEvent(new Event('input', { bubbles: true }));
        showToast('Instructions copied!', 'success');
        tabsContainer.querySelector('[data-tab="manual"]').click();
    });

    document.getElementById('agent-forge-close-btn').addEventListener('click', () => closeModal(modal));
    document.getElementById('agent-forge-run-btn').addEventListener('click', () => handleRunAgent(null));
    document.getElementById('agent-forge-save-btn').addEventListener('click', saveAgentBlueprint);

    const contextModal = document.getElementById('chatbot-context-modal');
    document.getElementById('agent-add-context-btn').addEventListener('click', () => {
        document.getElementById('chatbot-context-confirm-btn').dataset.source = 'agent';
        renderNoteListForContext(getAllNotes(state.collections), agentContextNoteIds);
        openModal(contextModal);
    });

    // Draggable Modal Logic
    let isDragging = false, offsetX, offsetY;
    header.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return;
        isDragging = true;
        const rect = modal.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        modal.style.transition = 'none';
        document.body.style.userSelect = 'none';
    });
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        let newX = e.clientX - offsetX;
        let newY = e.clientY - offsetY;
        modal.style.left = '0px';
        modal.style.top = '0px';
        modal.style.transform = `translate(${newX}px, ${newY}px)`;
    });
    document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        modal.style.transition = 'all 0.3s';
        document.body.style.userSelect = 'auto';
    });
};
// =================================================================
// START: AI AGENT FORGE - SESSION 2 LOGIC (Management)
// =================================================================
let activeAgentIdForEditing = null; // Used to know if we are creating or updating an agent

const saveAgentBlueprint = () => {
    const instructions = document.getElementById('agent-instructions-input').value.trim();
    if (!instructions) return showToast('Agent instructions cannot be empty.', 'error');

    const saveModal = document.getElementById('save-agent-modal');
    const nameInput = document.getElementById('save-agent-name-input');
    const triggerInput = document.getElementById('save-agent-trigger-input');
    const argumentInput = document.getElementById('save-agent-argument-name-input');
    const errorEl = document.getElementById('save-agent-error');
    errorEl.textContent = '';

    // Pre-fill modal based on whether we are editing an existing agent or creating a new one
    if (activeAgentIdForEditing) {
        const agentToEdit = state.agents.find(a => a.id === activeAgentIdForEditing);
        if(agentToEdit) {
            nameInput.value = agentToEdit.name;
            triggerInput.value = agentToEdit.trigger;
            argumentInput.value = agentToEdit.argumentName || '';
        }
    } else {
        nameInput.value = '';
        triggerInput.value = '';
        argumentInput.value = '{{note_name}}'; // A sensible default
    }

    openModal(saveModal, true);
    nameInput.focus();
    
    // The event listener is now attached outside this function, in init(), to prevent bugs.
    // We just need to show the modal.
};

// This new helper function will contain the actual save logic.
const handleSaveAgentConfirm = async () => {
    const instructions = document.getElementById('agent-instructions-input').value.trim();
    const saveModal = document.getElementById('save-agent-modal');
    const nameInput = document.getElementById('save-agent-name-input');
    const triggerInput = document.getElementById('save-agent-trigger-input');
    const argumentInput = document.getElementById('save-agent-argument-name-input');
    const errorEl = document.getElementById('save-agent-error');

    const name = nameInput.value.trim();
    const trigger = triggerInput.value.trim().replace(/\s+/g, '-');
    const argumentName = argumentInput.value.trim();

    if (!name || !trigger) {
        errorEl.textContent = 'Both name and command are required.';
        return;
    }

    const triggerInUse = state.agents.some(a => a.trigger === trigger && a.id !== activeAgentIdForEditing);
    if (triggerInUse) {
        errorEl.textContent = `Command "/run ${trigger}" is already in use.`;
        return;
    }

    if (activeAgentIdForEditing) {
        const agentToUpdate = state.agents.find(a => a.id === activeAgentIdForEditing);
        if (agentToUpdate) {
            agentToUpdate.name = name;
            agentToUpdate.trigger = trigger;
            agentToUpdate.instructions = instructions;
            agentToUpdate.argumentName = argumentName;
            agentToUpdate.contextNoteIds = [...agentContextNoteIds];
        }
    } else {
        const newAgent = {
            id: generateId('agent'),
            name,
            trigger,
            instructions,
            argumentName,
            contextNoteIds: [...agentContextNoteIds]
        };
        state.agents.push(newAgent);
    }
    
    await saveState(); // This is the fix
    showToast(`Agent "${name}" saved!`, 'success');
    closeModal(saveModal);
};

const renderAgentList = () => {
    const container = document.getElementById('agent-list-container');
    if (!state.agents || state.agents.length === 0) {
        container.innerHTML = '<p class="text-center text-text-secondary p-4">No agents saved yet. Create one in the Forge!</p>';
        return;
    }

    container.innerHTML = state.agents.map(agent => `
        <div class="p-3 bg-bg-pane-dark rounded-md flex justify-between items-center">
            <div class="flex-grow min-w-0">
                <p class="font-semibold text-text-primary truncate">${agent.name}</p>
                <code class="text-xs text-accent-primary bg-bg-main px-1.5 py-0.5 rounded">/run ${agent.trigger}</code>
            </div>
            <div class="flex items-center gap-1 flex-shrink-0 ml-2">
                <button class="agent-action-btn p-2 rounded hover:bg-bg-main" data-action="run" data-agent-id="${agent.id}" title="Run Agent"><i data-feather="play" class="w-4 h-4 pointer-events-none"></i></button>
                <button class="agent-action-btn p-2 rounded hover:bg-bg-main" data-action="edit" data-agent-id="${agent.id}" title="Edit Agent"><i data-feather="edit-2" class="w-4 h-4 pointer-events-none"></i></button>
                <button class="agent-action-btn p-2 rounded hover:bg-bg-main" data-action="export" data-agent-id="${agent.id}" title="Export Agent"><i data-feather="download" class="w-4 h-4 pointer-events-none"></i></button>

                <button class="agent-action-btn p-2 rounded hover:bg-bg-main text-red-500" data-action="delete" data-agent-id="${agent.id}" title="Delete Agent"><i data-feather="trash-2" class="w-4 h-4 pointer-events-none"></i></button>
            </div>
        </div>
    `).join('');
    feather.replace();
};

const openAgentListModal = () => {
    const modal = document.getElementById('agent-list-modal');
    renderAgentList();
    openModal(modal);
};
/**
 * Tries to parse a final instruction list back into the Step Builder UI.
 * This is for a better agent editing experience.
 */
const loadInstructionsIntoStepBuilder = (instructions) => {
    const stepContainer = document.getElementById('agent-step-container');
    const addStepBtn = document.getElementById('agent-add-step-btn');
    stepContainer.innerHTML = ''; // Clear existing steps

    const lines = instructions.split('\n');
    const stepRegex = /^\d+\.\s*(\w+):\s*(.*)$/;

    lines.forEach(line => {
        const match = line.trim().match(stepRegex);
        if (match) {
            const [, action, paramsStr] = match;

            // Simulate clicking "Add Step" to create a new step card
            addStepBtn.click();
            const newStepCard = stepContainer.lastElementChild;

            if (newStepCard && newStepCard.classList.contains('agent-step-card')) {
                // Set the action
                const actionSelect = newStepCard.querySelector('.agent-action-select');
                if (actionSelect) {
                    actionSelect.value = action;
                    // Trigger a change event to populate the parameter inputs
                    actionSelect.dispatchEvent(new Event('change', { bubbles: true }));
                }

                // Parse and fill the parameters
                const paramRegex = /(\w+):\s*"(.*?)"/g;
                let paramMatch;
                while ((paramMatch = paramRegex.exec(paramsStr)) !== null) {
                    const [, paramName, paramValue] = paramMatch;
                    const input = newStepCard.querySelector(`.param-input[data-param-name="${paramName}"]`);
                    if (input) {
                        input.value = paramValue;
                    }
                }
            }
        }
    });
};
const initAgentManagementListeners = () => {
    // Listeners for the Agent List modal
    const listModal = document.getElementById('agent-list-modal');
    listModal.addEventListener('click', async (e) => {
        const button = e.target.closest('.agent-action-btn');
        if (!button) return;

        const agentId = button.dataset.agentId;
        const agent = state.agents.find(a => a.id === agentId);
        if (!agent) return;

        switch(button.dataset.action) {
            case 'export': // ADD THIS NEW CASE
                handleExportAgent(agentId);
                break;
           case 'run':
                closeModal(listModal);
                
                // --- START: New Argument Handling Logic ---
                if (agent.argumentName) {
                    const argument = await showPrompt({
                        title: `Input for "${agent.name}"`,
                        message: `This agent requires the following input: ${agent.argumentName}`,
                        placeholder: 'Enter your input here...'
                    });

                    // Only run if the user provides an argument and clicks confirm
                    if (argument !== null) {
                        showToast(`Running agent: "${agent.name}"...`, 'info');
                        handleRunAgent(agent, argument);
                    }
                } else {
                    // If no argument is needed, run immediately
                    showToast(`Running agent: "${agent.name}"...`, 'info');
                    handleRunAgent(agent);
                }
                // --- END: New Argument Handling Logic ---
                break;
            case 'edit':
    // 1. Set the context for the agent being edited.
    activeAgentIdForEditing = agent.id;
    agentContextNoteIds = agent.contextNoteIds || [];

    // 2. Load the agent's instructions into the main instructions tab.
    document.getElementById('agent-instructions-input').value = agent.instructions;
    loadInstructionsIntoStepBuilder(agent.instructions);


    // 3. Render the context note pills in the Step Builder tab.
    const agentPillsContainer = document.getElementById('agent-context-pills');
    const allNotes = getAllNotes(state.collections);
    const contextNotes = allNotes.filter(n => agentContextNoteIds.includes(n.id));
    agentPillsContainer.innerHTML = contextNotes.map(note => `
        <div class="bg-bg-pane-dark text-text-secondary text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
            <span>${note.name}</span>
        </div>
    `).join('');

    // 4. Close the list modal and open the main forge modal for editing.
    closeModal(listModal);
    openModal(document.getElementById('agent-forge-modal'));
    feather.replace();
    break;
            case 'delete':
    state.agents = state.agents.filter(a => a.id !== agentId);
    await saveState(); // This is the fix
    renderAgentList();
    showToast('Agent deleted.', 'success');
    break;
        }
    });
    const agentImportInput = document.getElementById('agent-import-input');
document.getElementById('import-agent-btn').addEventListener('click', () => {
    agentImportInput.click();
});
agentImportInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleImportAgent(file);
    e.target.value = '';
});

// Listeners for the Remapping Modal
const remapModal = document.getElementById('agent-remap-modal');
document.getElementById('agent-remap-cancel-btn').addEventListener('click', () => closeModal(remapModal));
document.getElementById('agent-remap-modal-close-btn').addEventListener('click', () => closeModal(remapModal));
document.getElementById('agent-remap-confirm-btn').addEventListener('click', handleConfirmAgentImport);

    document.getElementById('agent-list-close-btn').addEventListener('click', () => closeModal(listModal));
    document.getElementById('agent-list-done-btn').addEventListener('click', () => closeModal(listModal));
};
// =================================================================
// END: AI AGENT FORGE - SESSION 2 LOGIC
// =================================================================
// =================================================================
// END: AI AGENT FORGE - SESSION 1 LOGIC
// =================================================================
const commands = [
    { name: 'nn', description: 'New Note. Usage: /nn [note name]', execute: async(args)=>{ const noteName = args || 'Untitled Note'; await createNewNote(true, { name: noteName }); showToast(`✅ Note "${noteName}" created`); } },
    // ADD THIS ENTIRE OBJECT TO YOUR COMMANDS ARRAY
{
    name: 'load',
    description: 'Fetch all Note Data.',
    execute: async () => {
        const toastId = showToast('🧠 Loading all note contents...', 'loading');
        try {
            const { getDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
            const allNoteStubs = getAllNotes(state.collections);
            let notesWereLoaded = false;

            const fetchPromises = allNoteStubs.map(noteStub => {
                if (!window.noteCache[noteStub.id]) {
                    notesWereLoaded = true;
                    const noteRef = doc(db, "notes", noteStub.id);
                    return getDoc(noteRef).then(noteSnap => {
                        if (noteSnap.exists()) {
                            const fullNoteData = noteSnap.data();
                            window.noteCache[noteStub.id] = fullNoteData;

                            // --- THIS IS THE FIX ---
                            // 1. Generate an excerpt from the full content.
                            const plainText = (fullNoteData.content || '').replace(/<[^>]*>?/gm, ' ').trim();
                            const excerpt = plainText.substring(0, 200);
                            
                            // 2. Update the note stub in the main state with the new excerpt.
                            noteStub.excerpt = excerpt;
                            // --- END OF FIX ---
                        }
                    });
                }
                return Promise.resolve();
            });

            await Promise.all(fetchPromises);
            
            if (notesWereLoaded) {
                await saveState(); // Persist the new excerpts to the main state document
                buildLunrIndex();  // Rebuild the search index with all content
                render();          // Re-render the UI to show the new excerpts in lists
            }
            
            dismissToast(toastId);
            showToast(`✅ All ${allNoteStubs.length} notes loaded and indexed.`, 'success');

        } catch (error) {
            dismissToast(toastId);
            showToast('Error loading all notes.', 'error');
            console.error(error);
        }
    }
},// Add this inside the commands = [...] array
{
    name: 'forge',
    description: 'Opens the AI Agent Forge to create a new agent.',
    execute: () => {
        activeAgentIdForEditing = null; // Ensure we're in "create new" mode
        agentContextNoteIds = [];
        document.getElementById('agent-context-pills').innerHTML = '';
        document.getElementById('agent-instructions-input').value = '';
        document.getElementById('agent-forge-logs').innerHTML = '<div class="forge-placeholder">Awaiting instructions...</div>';
        openModal(document.getElementById('agent-forge-modal'));
        feather.replace();
    }
},

// AND ADD THESE TWO NEW COMMANDS:
{
    name: 'agents',
    description: 'View and manage your saved AI agents.',
    execute: openAgentListModal
},
{
    name: 'run',
    description: 'Run a saved AI agent. Usage: /run [agent-command] (argument)',
    execute: (args) => {
    const parts = args.trim().split(' ');
    const trigger = parts[0];
    const argument = parts.slice(1).join(' ').trim();

    if (!trigger) return showToast('Please specify which agent to run.', 'error');
    
    const agentToRun = state.agents.find(a => a.trigger === trigger);
    if (!agentToRun) return showToast(`Agent "/run ${trigger}" not found.`, 'error');

    if (agentToRun.argumentName && !argument) {
        // This is the corrected, more intuitive usage message
        return showToast(`Agent "${agentToRun.name}" requires an argument. Usage: /run ${agentToRun.trigger} (your argument text)`, 'error');
    }

    // Pass the agent and the argument to the handler
    showToast(`Running agent: "${agentToRun.name}"...`, 'info');
    handleRunAgent(agentToRun, argument);
}
},
    { name: 'nf', description: 'New Folder. Usage: /nf [folder name]', execute: (args)=>{const n=args||'Untitled Folder';const c={id:generateId('c'),name:n,type:'folder',children:[],expanded:true};state.kanbanColumns[c.id]=[{id:generateId('col'),title:'To Do'}];state.collections.push(c);saveState();buildLunrIndex();render();showToast(`✅ Folder "${n}" created`)}},
{ name: 'rename', description: 'Rename item. Usage: /rename [old] to [new]', suggest: 'items', execute: async(args)=>{ const separator = /\s+to\s+/i; if (!separator.test(args)) return showToast('❌ Use: /rename [old] to [new]','error'); const parts = args.split(separator); const oldName = parts[0].trim(); const newName = parts[1].trim(); if (!oldName || !newName) return showToast('❌ Both names required.','error'); const itemToRenameCopy = findBestMatch(oldName, [...getAllNotes(state.collections), ...getAllFolders()]); if (!itemToRenameCopy) return showToast(`❌ Not found: "${oldName}"`,'error'); const findResult = findItem(itemToRenameCopy.id); if (!findResult || !findResult.item) { return showToast('❌ Could not locate the original item to rename.', 'error'); } const originalItem = findResult.item; const confirmed = await showConfirm({title:'Confirm Rename', message:`Rename "${originalItem.name}" to "${newName}"?`, confirmText:'Rename'}); if (confirmed) { const previousName = originalItem.name; originalItem.name = newName; try { if (originalItem.type === 'note') { const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"); const noteRef = doc(db, "notes", originalItem.id); await updateDoc(noteRef, { name: newName }); if (window.noteCache[originalItem.id]) { window.noteCache[originalItem.id].name = newName; } } await saveState(); buildLunrIndex(); render(); showToast(`✅ Renamed to "${newName}"`); } catch (error) { console.error("Error renaming item:", error); showToast('❌ A database error occurred. Rename failed.', 'error'); originalItem.name = previousName; } } } },    { name: 'link', description: 'Link notes. Usage: /link [source] to [target]', suggest: 'notes', execute: (args)=>{const s=/\s+to\s+/i;if(!s.test(args))return showToast('❌ Use: /link [source] to [target]','error');const p=args.split(s);const sN=p[0].trim();const tN=p[1].trim();if(!sN||!tN)return showToast('❌ Both notes required.','error');const aN=getAllNotes(state.collections);const sO=findBestMatch(sN,aN);const tO=findBestMatch(tN,aN);if(!sO)return showToast(`❌ Source not found: "${sN}"`,'error');if(!tO)return showToast(`❌ Target not found: "${tN}"`,'error');if(sO.id===tO.id)return showToast('❌ Cannot link a note to itself.','error');sO.content+=`\n<p>[[${tO.name}]]</p>`;updateNoteLinks(sO);sO.modifiedAt=new Date().toISOString();saveState();if(state.settings.activeNoteId===sO.id)renderNoteEditor();showToast(`✅ Linked "${sO.name}" to "${tO.name}"`)}},
    { name: 'unlink', description: 'Unlink notes. Usage: /unlink [target] from [source]', suggest: 'notes', execute: (args)=>{const s=/\s+from\s+/i;if(!s.test(args))return showToast('❌ Use: /unlink [target] from [source]','error');const p=args.split(s);const tN=p[0].trim();const sN=p[1].trim();if(!sN||!tN)return showToast('❌ Both notes required.','error');const aN=getAllNotes(state.collections);const sO=findBestMatch(sN,aN);const tO=findBestMatch(tN,aN);if(!sO)return showToast(`❌ Source not found: "${sN}"`,'error');if(!tO)return showToast(`❌ Target not found: "${tN}"`,'error');const r=new RegExp(`\\[\\[\\s*${tO.name}\\s*\\]\\]`,'gi');if(!r.test(sO.content))return showToast(`❌ Link to "${tO.name}" not found in "${sO.name}".`,'info');sO.content=sO.content.replace(r,'').replace(/<p>\s*<\/p>|\n\s*\n/gi,'');updateNoteLinks(sO);sO.modifiedAt=new Date().toISOString();saveState();if(state.settings.activeNoteId===sO.id)renderNoteEditor();showToast(`✅ Unlinked "${tO.name}" from "${sO.name}"`)}},
    { name: 'go', description: 'Go to item or tag. Usage: /go [item] or /go #[tag] [item]', suggest: 'items_or_tags', execute: (args)=>{if(!args)return showToast('❌ Specify item or tag.','error');if(args.startsWith('#')){const tN=args.split(' ')[0].substring(1).trim();const nN=args.substring(tN.length+2).trim();if(!tN)return showToast('❌ Tag name needed.','error');if(!getAllTags().includes(tN))return showToast(`❌ Tag not found: #${tN}`,'error');if(nN){const nT=getAllNotes(state.collections).filter(n=>(n.tags||[]).includes(tN));const t=findBestMatch(nN,nT);if(t){executeWithSmartFind(t.name,'notes',(i)=>{state.settings.activeTag=null;if(i.type==='note'){const{parent}=findItem(i.id);state.settings.activeCollectionId=(Array.isArray(parent)||!parent)?null:parent.id;state.settings.activeNoteId=i.id}showToast(`🚀 Navigated to "${i.name}"`);saveState();render()})}else{showToast(`❌ Note "${nN}" not in tag #${tN}.`,'error')}}else{state.settings.activeTag=tN;state.settings.activeNoteId=null;state.settings.activeCollectionId=null;showToast(`🏷️ Showing notes tagged with #${tN}`);saveState();render()}}else{executeWithSmartFind(args,'items',(i)=>{state.settings.activeTag=null;if(i.type==='note'){const{parent}=findItem(i.id);state.settings.activeCollectionId=(Array.isArray(parent)||!parent)?null:parent.id;state.settings.activeNoteId=i.id}else{state.settings.activeCollectionId=i.id;state.settings.activeNoteId=null}showToast(`🚀 Navigated to "${i.name}"`);saveState();render()})}} },
    { name: 'theme', description: 'Toggle through color themes.', execute: ()=>document.getElementById('theme-toggle')?.click() },
    // Add this object inside your commands array
{
    name: 'updatelinks',
    description: 'Scans all notes and fixes links pointing to renamed notes.',
    execute: updateAllLinksAgent
},
    { name: 'voice', description: 'Start/stop voice dictation in current note.', execute: ()=>{if(!state.settings.activeNoteId)return showToast('❌ Must be in a note.','error');document.getElementById('dictate-btn')?.click()} },
    { name: 'linked', description: 'Show all connections for a note. Usage: /linked [note name]', suggest: 'notes', execute: (args)=>executeWithSmartFind(args, 'notes', (note)=>renderLinkedNotesModal(note)) },
    { name: 'help', description: 'Shows this list of all available commands.', execute: renderHelpModal },
    { name: 'commands', description: 'Alias for /help.', execute: renderHelpModal },
    { name: 'calculator', description: 'Opens a draggable calculator.', execute: () => openModal(document.getElementById('calculator-modal')) },// Add this command object inside the `commands` array
{ 
    name: 'timer', 
    description: 'Opens a draggable timer and stopwatch.', 
    execute: () => openModal(document.getElementById('timer-modal')) 
},
    { name: 'ask', description: 'Ask Your Notes AI. Usage: /ask [question]', execute: (args)=>{if(!args)return showToast('❌ Question needed.','error');openModal(document.getElementById('global-ai-modal'));document.getElementById('global-ai-input').value=args;document.getElementById('global-ai-ask-btn').click();feather.replace()} },
    { name: 'summary', description: 'Summarize a note. Usage: /summary [note name]', suggest: 'notes', execute: (args)=>executeWithSmartFind(args,'notes',(noteStub)=>{
        const noteData = window.noteCache[noteStub.id]; // FIX: Get full data from cache
        const plainContent=(noteData?.content||'').replace(/<[^>]*>?/gm,'').trim();if(!plainContent)return showToast('Note empty.','info');handleSummarize(plainContent)})},
    { name: 'quiz', description: 'Generate quiz. Usage: /quiz [note name]', suggest: 'notes', execute: (args)=>executeWithSmartFind(args,'notes',(noteStub)=>{
        const noteData = window.noteCache[noteStub.id]; // FIX: Get full data from cache
        const note = noteData ? {id: noteStub.id, ...noteData} : null;
        const plainContent=(noteData?.content||'').replace(/<[^>]*>?/gm,'').trim();if(!plainContent)return showToast('Note empty.','info');handleGenerateQuiz(plainContent, note)})},
    { name: 'flashcard', description: 'Open flashcards. Usage: /flashcard [note name]', suggest: 'notes', execute: (args)=>executeWithSmartFind(args,'notes',(noteStub)=>{
        const noteData = window.noteCache[noteStub.id]; // FIX: Get full data from cache
        const note = noteData ? {id: noteStub.id, ...noteData} : null;
        handleFlashcardMode(note)})},
    { name: 'share', description: 'Create share link. Usage: /share [note name]', suggest: 'notes', execute: (args)=>executeWithSmartFind(args,'notes',(noteStub)=>handleShareNote(noteStub))},
    {
    name: 'checkpoint',
    description: 'Save Note Version. Usage: /checkpoint [message]',
    execute: (args) => {
        const noteId = state.settings.activeNoteId;
        if (!noteId) {
            return showToast('❌ You must be in a note to save a checkpoint.', 'error');
        }
        if (!args) {
            return showToast('❌ A message is required for the checkpoint.', 'error');
        }
        
        // This ensures the very latest typed content is captured before versioning
        performImmediateSave(); 
        
        // FIX: Get note data from the global cache
        const noteData = window.noteCache[noteId];
        if (noteData) {
            saveNoteVersion(noteId, noteData.content, args);
            saveState();
            showToast(`✅ Checkpoint saved: "${args}"`, 'success');
        }
    }
},{
    name: 'list',
    description: 'Switch to list view. Usage: /list [folder name]',
    suggest: 'folders',
    execute: (args) => {
        const targetView = 'list';
        if (args) {
            const targetFolder = findBestMatch(args, getAllFolders());
            if (targetFolder) {
                state.settings.activeCollectionId = targetFolder.id;
                state.settings.activeNoteId = null;
                state.settings.activeView = targetView;
                saveState();
                render();
                showToast(`Showing List View for "${targetFolder.name}"`);
            } else {
                showToast(`❌ Folder not found: "${args}"`, 'error');
            }
        } else {
            let currentFolderId = state.settings.activeCollectionId;
            if (state.settings.activeNoteId) {
                const noteResult = findItem(state.settings.activeNoteId);
                const parent = noteResult ? noteResult.parent : null;
                if (parent && !Array.isArray(parent)) {
                    currentFolderId = parent.id;
                }
            }
            if (currentFolderId) {
                state.settings.activeCollectionId = currentFolderId;
                state.settings.activeNoteId = null;
                state.settings.activeView = targetView;
                saveState();
                render();
            } else {
                showToast('Please select a folder first.', 'info');
            }
        }
    }
},{
    name: 'add',
    suggest: 'checklists',
    description: 'Add to checklist. Usage: /add [checklist name] [item text]',
    // REPLACE THE 'execute' FUNCTION FOR THE 'add' COMMAND WITH THIS CORRECTED VERSION
execute: (args) => {
    const noteId = state.settings.activeNoteId;
    if (!noteId) {
        return showToast('❌ Must be in a note to add a checklist item.', 'error');
    }
    if (!args) {
        return showToast('❌ Usage: /add [checklist name] [item text]', 'error');
    }

    const editorBody = app.elements.noteEditorBody;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = editorBody.innerHTML;

    const checklists = Array.from(tempDiv.querySelectorAll('.checklist-container'));
    if (checklists.length === 0) {
        return showToast('❌ No checklists found in this note.', 'info');
    }

    let targetChecklist = null;
    let itemText = '';

    const checklistData = checklists.map(cl => ({
        element: cl,
        title: cl.querySelector('.checklist-title')?.textContent.trim() || ''
    })).sort((a, b) => b.title.length - a.title.length);

    for (const data of checklistData) {
        if (!data.title) continue;

        const lowerArgs = args.toLowerCase();
        const lowerTitle = data.title.toLowerCase();
        const quotedTitle = `"${lowerTitle}"`;

        // Check 1: Does the argument start with the quoted title?
        if (lowerArgs.startsWith(quotedTitle)) {
            targetChecklist = data.element;
            // --- FIX: Correctly slice the string AFTER the quoted title ---
            itemText = args.substring(quotedTitle.length).trim();
            break;
        }

        // Check 2: Does it start with the non-quoted title (and is followed by a space)?
        if (lowerArgs.startsWith(lowerTitle) && (args.length === data.title.length || /\s/.test(args[data.title.length]))) {
            targetChecklist = data.element;
            itemText = args.substring(data.title.length).trim();
            break;
        }
    }

    if (!targetChecklist) {
        return showToast('❌ Could not find a checklist with that name.', 'error');
    }
    if (!itemText) {
        return showToast('❌ Please provide text for the checklist item.', 'error');
    }

    const checklistBody = targetChecklist.querySelector('.checklist-body');
    const newItem = document.createElement('li');
    newItem.className = 'checklist-item';
    newItem.dataset.checked = 'false';
    newItem.innerHTML = `
        <input type="checkbox" class="checklist-item-checkbox" onclick="return false;">
        <span class="checklist-item-text" contenteditable="false">${itemText.replace(/</g, "&lt;")}</span>
    `;
    checklistBody.appendChild(newItem);

    editorBody.innerHTML = tempDiv.innerHTML;

    const liveChecklistElement = Array.from(editorBody.querySelectorAll('.checklist-container')).find(
        el => el.querySelector('.checklist-title')?.textContent.trim() === targetChecklist.querySelector('.checklist-title')?.textContent.trim()
    );
    if (liveChecklistElement) {
        updateChecklistProgress(liveChecklistElement);
    }

    isNoteDirty = true;
    updateSaveIndicator();
    performImmediateSave();
    showToast(`✅ Added "${itemText}" to checklist.`);
}
},{
    name: 'remove',
    suggest: 'checklist_items',
    description: 'Remove item from checklist. Usage: /remove [item name]',
    execute: (args) => {
        const noteId = state.settings.activeNoteId;
        if (!noteId) return showToast('❌ Must be in a note.', 'error');
        if (!args) return showToast('❌ Please specify an item to remove.', 'error');

        const editorBody = app.elements.noteEditorBody;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = editorBody.innerHTML;

        const checklists = Array.from(tempDiv.querySelectorAll('.checklist-container'));
        if (checklists.length === 0) return showToast('❌ No checklists found.', 'info');

        // Attempt 1: Match as [Checklist Name] [Item Text] for explicit removal
        const checklistData = checklists.map(cl => ({
            element: cl,
            title: cl.querySelector('.checklist-title')?.textContent.trim() || ''
        })).sort((a, b) => b.title.length - a.title.length);

        for (const data of checklistData) {
            if (data.title && args.toLowerCase().startsWith(data.title.toLowerCase())) {
                const itemQuery = args.substring(data.title.length).trim();
                if (itemQuery) {
                    const items = Array.from(data.element.querySelectorAll('.checklist-item-text')).map(el => ({ text: el.textContent, element: el.parentElement }));
                    const fuse = new Fuse(items, { keys: ['text'], threshold: 0.3 });
                    const results = fuse.search(itemQuery);
                    if (results.length > 0) {
                        const itemToRemove = results[0].item.element;
                        const removedText = results[0].item.text;
                        itemToRemove.remove(); // Remove from the temporary element
                        editorBody.innerHTML = tempDiv.innerHTML; // Update the live editor

                        const liveEl = Array.from(editorBody.querySelectorAll('.checklist-container')).find(c => c.querySelector('.checklist-title')?.textContent.trim() === data.title);
                        if(liveEl) updateChecklistProgress(liveEl);

                        performImmediateSave();
                        return showToast(`✅ Removed "${removedText}" from "${data.title}".`);
                    }
                }
            }
        }

        // Attempt 2: If no explicit match, treat entire args as the item name
        const allItems = [];
        checklists.forEach(cl => {
            const title = cl.querySelector('.checklist-title')?.textContent.trim();
            cl.querySelectorAll('.checklist-item').forEach(itemEl => {
                allItems.push({
                    text: itemEl.querySelector('.checklist-item-text').textContent,
                    element: itemEl,
                    checklistTitle: title
                });
            });
        });

        const fuse = new Fuse(allItems, { keys: ['text'], includeScore: true, threshold: 0.3 });
        const potentialMatches = fuse.search(args).filter(res => res.score < 0.4); 

        if (potentialMatches.length === 0) {
            return showToast(`❌ Item not found: "${args}"`, 'error');
        }

        if (potentialMatches.length > 1) {
            const firstMatchText = potentialMatches[0].item.text;
            if (potentialMatches.every(res => res.item.text.toLowerCase() === firstMatchText.toLowerCase())) {
                return showToast(`❌ "${firstMatchText}" exists in multiple lists. Please specify the list name: /remove [list name] [item name]`, 'error');
            }
        }

        const bestMatch = potentialMatches[0].item;
        bestMatch.element.remove(); // Remove from the temporary element
        editorBody.innerHTML = tempDiv.innerHTML; // Update the live editor

        const liveChecklistElement = Array.from(editorBody.querySelectorAll('.checklist-container')).find(
            el => el.querySelector('.checklist-title')?.textContent.trim() === bestMatch.checklistTitle
        );
        if (liveChecklistElement) {
            updateChecklistProgress(liveChecklistElement);
        }

        isNoteDirty = true;
        updateSaveIndicator();
        performImmediateSave();
        showToast(`✅ Removed "${bestMatch.text}".`);
    }
},{
    name: 'save',
    description: 'Save a manual checkpoint of the current note',
    execute: () => {
        const noteId = state.settings.activeNoteId;
        if (!noteId) {
            return showToast('❌ You must be in a note to save a checkpoint.', 'error');
        }

        performImmediateSave(); // Ensure latest content is captured before versioning

        const noteData = window.noteCache[noteId];
        if (noteData) {
            const versions = state.versions?.[noteId] || [];
            const savedRegex = /^Saved(\s(\d+))?$/;
            let maxNum = -1; 

            versions.forEach(v => {
                const match = v.message?.match(savedRegex);
                if (match) {
                    if (match[2]) {
                        const num = parseInt(match[2], 10);
                        if (num > maxNum) maxNum = num;
                    } else {
                        if (maxNum < 0) maxNum = 0;
                    }
                }
            });

            const message = (maxNum === -1) ? 'Saved' : `Saved ${maxNum + 1}`;
            
            saveNoteVersion(noteId, noteData.content, message);
            saveState();
            showToast(`✅ Checkpoint saved: "${message}"`, 'success');
        }
    }
},{
    name: 'google',
    description: 'Search Google or Open a Website. Usage: /google [query]',
    execute: (args) => {
        if (!args) {
            return showToast('❌ Please provide a search query or a website.', 'error');
        }
        // Heuristic to detect if the argument is likely a website URL
        if (args.includes('.') && !args.includes(' ')) {
            let url = args;
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }
            window.open(url, '_blank');
            showToast(`🚀 Opening ${args}...`);
        } else {
            // It's a search query
            const searchQuery = encodeURIComponent(args);
            const searchUrl = `https://www.google.com/search?q=${searchQuery}`;
            window.open(searchUrl, '_blank');
            showToast(`🔍 Searching Google for "${args}"...`);
        }
    }
},
{
    name: 'calendar',
    description: 'Switch to calendar view. Usage: /calendar [folder name]',
    suggest: 'folders',
    execute: (args) => {
        const targetView = 'calendar';
        if (args) {
            const targetFolder = findBestMatch(args, getAllFolders());
            if (targetFolder) {
                state.settings.activeCollectionId = targetFolder.id;
                state.settings.activeNoteId = null;
                state.settings.activeView = targetView;
                saveState();
                render();
                showToast(`Showing Calendar View for "${targetFolder.name}"`);
            } else {
                showToast(`❌ Folder not found: "${args}"`, 'error');
            }
        } else {
            let currentFolderId = state.settings.activeCollectionId;
            if (state.settings.activeNoteId) {
                const noteResult = findItem(state.settings.activeNoteId);
                const parent = noteResult ? noteResult.parent : null;
                if (parent && !Array.isArray(parent)) {
                    currentFolderId = parent.id;
                }
            }
            if (currentFolderId) {
                state.settings.activeCollectionId = currentFolderId;
                state.settings.activeNoteId = null;
                state.settings.activeView = targetView;
                saveState();
                render();
            } else {
                showToast('Please select a folder first.', 'info');
            }
        }
    }
},
{
    name: 'date',
    description: 'Set a date. Usage: /date [Property Name] DD/MM/YY',
    execute: (args) => {
        if (!state.settings.activeNoteId) {
            return showToast('❌ This command can only be used inside a note.', 'error');
        }

        const dateRegex = /^(.*)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})$/;
        const match = args.match(dateRegex);

        if (!match) {
            return showToast('❌ Invalid format. Use: /date [Property Name] DD/MM/YY', 'error');
        }

        const propName = match[1].trim();
        const dateString = match[2];
        const dateParts = dateString.split('/');

        if (dateParts.length !== 3) {
             return showToast('❌ Invalid date format. Use DD/MM/YY.', 'error');
        }

        const day = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10);
        let year = parseInt(dateParts[2], 10);

        if (year < 100) {
            year += 2000;
        }

        if (isNaN(day) || isNaN(month) || isNaN(year)) {
             return showToast('❌ Invalid date value.', 'error');
        }

        const dateObj = new Date(Date.UTC(year, month - 1, day));
        
        if (isNaN(dateObj.getTime())) {
            return showToast('❌ Invalid date. Please check the day, month, and year.', 'error');
        }

        const note = findItem(state.settings.activeNoteId)?.item;
        if (note) {
            if (!note.properties) {
                note.properties = {};
            }
            note.properties[propName] = {
                type: 'date',
                value: dateObj.toISOString()
            };
            note.modifiedAt = new Date().toISOString();
            
            performImmediateSave();
            renderNoteProperties(note);
            feather.replace();
            showToast(`✅ Set date for "${propName}"`, 'success');
        }
    }
},
    {
        name: 'history',
        description: 'Open version history for a note. Usage: /history [note name]',
        suggest: 'notes',
        execute: (args) => {
            executeWithSmartFind(args, 'notes', (note) => {
                state.settings.activeNoteId = note.id;
                openVersionHistoryModal();
            });
        }
    },
    { name: 'dup', description: 'Duplicate an item. Usage: /dup [item name]', suggest: 'items', execute: (args)=>executeWithSmartFind(args,'items',(i)=>{const r=findItem(i.id);const nI=duplicateItem(i);const pA=Array.isArray(r.parent)?r.parent:r.parent.children;pA.splice(r.index+1,0,nI);showToast(`✅ Duplicated "${i.name}"`);saveState();buildLunrIndex();render()})},
    { name: 'pin', description: 'Toggle pin on a note. Usage: /pin [note name]', suggest: 'notes', execute: (args)=>executeWithSmartFind(args,'notes',(n)=>{n.pinned=!n.pinned;showToast(n.pinned?`📌 Pinned "${n.name}"`:`👎 Unpinned "${n.name}"`);saveState();render()})},
    { name: 'tag', description: 'Add a tag to current note. Usage: /tag [tagname]', execute: (args)=>{if(!state.settings.activeNoteId)return showToast('❌ Must be in a note.','error');if(!args)return showToast('❌ Tag name needed.','error');const tN=args.split(' ')[0].replace(/#/g,'');if(!tN)return;app.elements.noteEditorBody.innerHTML+=` #${tN}`;performImmediateSave();showToast(`🏷️ Tagged with #${tN}`)}},
    {
        name: 'clear',
        description: 'Clear all content from a note. Usage: /clear [note name]',
        suggest: 'notes',
        execute: (args) => executeWithSmartFind(args, 'notes', async (note) => {
            const confirmed = await showConfirm({
                title: `Clear Content of "${note.name}"`,
                message: 'This will permanently delete all content inside this note. This action cannot be undone.',
                confirmText: 'Clear Content',
                confirmClass: 'bg-red-600'
            });

            if (confirmed) {
                note.content = '';
                note.modifiedAt = new Date().toISOString();
                updateNoteLinks(note);
                updateNoteTags(note);
                
                saveState();
                buildLunrIndex();
                render();
                
                showToast(`✅ Content cleared from "${note.name}"`, 'success');
            }
        })
    },{
    name: 'notegraph',
    description: 'Show note graph. Usage: /notegraph [note name]',
    suggest: 'notes',
    execute: (args) => {
        executeWithSmartFind(args, 'notes', (note) => {
            // This reuses the same logic as the toolbar button
            const graphBtn = document.getElementById('graph-btn');
            if (graphBtn) {
                // Temporarily set the active note to the one we want to graph
                const originalActiveNote = state.settings.activeNoteId;
                state.settings.activeNoteId = note.id;
                graphBtn.click();
                // Restore the original active note so the UI doesn't jump
                state.settings.activeNoteId = originalActiveNote;
            }
        });
    }
},{
    name: 'checklist',
    description: 'Adds a new checklist. Usage: /checklist [Optional Title]',
    execute: (args) => {
        if (!state.settings.activeNoteId) {
            return showToast('❌ You must be in a note to add a checklist.', 'error');
        }

        const title = args ? args.replace(/</g, "&lt;") : 'Untitled Checklist';

        restoreSelectionAndExec(() => {
            const newDefaultChecklistHTML = `
<div class="checklist-container" contenteditable="false">
    <div class="checklist-header">
        <h4 class="checklist-title font-semibold text-text-primary flex-grow">${title}</h4>
        <button class="checklist-header-btn" data-action="edit" title="Edit Checklist"><i data-feather="edit" class="w-4 h-4"></i></button>
        <button class="checklist-header-btn delete" data-action="delete" title="Delete Checklist"><i data-feather="trash-2" class="w-4 h-4"></i></button>
    </div>
    <div class="checklist-progress-container">
        <div class="checklist-progress-bar">
            <div class="checklist-progress-fill" style="width: 0%;"></div>
        </div>
        <span class="checklist-progress-text">0% Complete</span>
    </div>
    <ul class="checklist-body">
        <li class="checklist-item" data-checked="false"><input type="checkbox" class="checklist-item-checkbox" onclick="return false;"><span class="checklist-item-text" contenteditable="false">New item</span></li>
    </ul>
</div>
<p><br></p>
`;
            document.execCommand('insertHTML', false, newDefaultChecklistHTML);
            feather.replace();
        });
        showToast('✅ Checklist added.');
    }
},// ... inside the 'commands' array
{
    name: 'move',
    description: 'Move a note to a folder. Usage: /move [note] to [folder]',
    suggest: 'items', // This will suggest both notes and folders
    execute: (args) => {
        const separator = /\s+to\s+/i;
        if (!separator.test(args)) {
            return showToast('❌ Invalid format. Use: /move [note name] to [folder name]', 'error');
        }

        const [noteName, folderName] = args.split(separator).map(s => s.trim());

        if (!noteName || !folderName) {
            return showToast('❌ Both a note and folder name are required.', 'error');
        }

        const allNotes = getAllNotes(state.collections);
        const allFolders = getAllFolders();

        const noteToMove = findBestMatch(noteName, allNotes);
        const targetFolder = findBestMatch(folderName, allFolders);

        if (!noteToMove) {
            return showToast(`❌ Note not found: "${noteName}"`, 'error');
        }
        if (!targetFolder) {
            return showToast(`❌ Target folder not found: "${folderName}"`, 'error');
        }

        // Find the note in the state tree to remove it from its current location
        const sourceResult = findItem(noteToMove.id);
        if (!sourceResult) return; // Should not happen, but a good safeguard

        const sourceArray = Array.isArray(sourceResult.parent) ? sourceResult.parent : sourceResult.parent.children;
        
        // Check if the note is already in the target folder
        if (sourceResult.parent && sourceResult.parent.id === targetFolder.id) {
            return showToast(`Note is already in "${targetFolder.name}".`, 'info');
        }

        // Remove the note from its original array
        const [movedNote] = sourceArray.splice(sourceResult.index, 1);

        // Add the note to the target folder's children array
        if (!targetFolder.children) {
            targetFolder.children = [];
        }
        targetFolder.children.unshift(movedNote);

        // Update the note's Kanban status to the first column of the new folder
        movedNote.status = state.kanbanColumns[targetFolder.id]?.[0]?.id || null;
        movedNote.modifiedAt = new Date().toISOString();

        // Save changes and update the UI
        saveState();
        buildLunrIndex();
        render();
        showToast(`✅ Moved "${movedNote.name}" to "${targetFolder.name}"`, 'success');
    }
},{
    name: 'table',
    description: 'Create a table. Usage: /table [rows]x[cols]. Defaults to 3x2.',
    execute: (args) => {
        if (!state.settings.activeNoteId) {
            return showToast('❌ You must be in a note to create a table.', 'error');
        }

        let rows = 3;
        let cols = 2;

        if (args) {
            const match = args.match(/(\d+)\s*x\s*(\d+)/i);
            if (match) {
                rows = parseInt(match[1], 10) || 3;
                cols = parseInt(match[2], 10) || 2;
            } else {
                 return showToast('❌ Invalid format. Use [rows]x[cols], e.g., 4x3.', 'error');
            }
        }
        
        if (rows > 50 || cols > 20) {
            return showToast('❌ Table size is too large (max 50x20).', 'error');
        }

        let tableHTML = '<table style="width:100%"><thead>';
tableHTML += `<tr><th colspan="${cols}" contenteditable="false"><div class="table-header-controls"><div class="table-filter-wrapper flex-grow"><i data-feather="search" class="filter-icon"></i><input class="table-filter-input" placeholder="Filter table..."/></div><button class="toggle-filter-btn" title="Toggle Filter"><i data-feather="chevrons-up" class="w-4 h-4"></i></button><button class="delete-table-btn" title="Delete Table"><i data-feather="trash-2" class="w-4 h-4"></i></button></div></th></tr>`;
        tableHTML += '<tr>';
        for (let i = 0; i < cols; i++) {
            tableHTML += `<th class="sortable-header" data-sort-dir="none" contenteditable="true">Header ${i + 1}</th>`;
        }
        tableHTML += '</tr></thead><tbody>';
        for (let i = 0; i < rows; i++) {
            tableHTML += '<tr>';
            for (let j = 0; j < cols; j++) {
                tableHTML += '<td contenteditable="true"><br></td>';
            }
            tableHTML += '</tr>';
        }
        tableHTML += '</tbody></table><p><br></p>';

        restoreSelectionAndExec(() => document.execCommand('insertHTML', false, tableHTML));
        feather.replace();
        showToast(`✅ Table (${rows}x${cols}) created.`);
    }
},{
    name: 'recalculate',
    description: 'Usage: /recalculate [column name] or /recalculate for all.',
    suggest: 'none',
    execute: (args) => {
        const columnName = args ? args.trim() : null;

        const activeNoteId = state.settings.activeNoteId;
        if (!activeNoteId) {
            return showToast('❌ You must be in a note to use this command.', 'error');
        }

        const editorBody = app.elements.noteEditorBody;
        const table = editorBody.querySelector('table');

        if (!table) {
            return showToast('❌ No table found in the current note.', 'error');
        }

        // If a column name is provided, recalculate that specific column
        if (columnName) {
            const headers = Array.from(table.querySelectorAll('thead tr:last-child th'));
            let targetHeader = null;
            let targetColIndex = -1;

            for (let i = 0; i < headers.length; i++) {
                if (headers[i].innerText.trim().toLowerCase() === columnName.toLowerCase()) {
                    targetHeader = headers[i];
                    targetColIndex = i;
                    break;
                }
            }

            if (!targetHeader) {
                return showToast(`❌ Column "${columnName}" not found in the table.`, 'error');
            }

            const formula = targetHeader.dataset.formula;
            if (!formula) {
                return showToast(`❌ No custom formula is set for the "${columnName}" column.`, 'info');
            }

            performCustomFormula(table, targetColIndex, formula);
            showToast(`✅ Recalculated column "${columnName}".`, 'success');

        } else {
            // If no column name, recalculate all columns with a formula
            const headersWithFormulas = Array.from(table.querySelectorAll('thead tr:last-child th[data-formula]'));
            
            if (headersWithFormulas.length === 0) {
                return showToast('No columns with formulas found in this table.', 'info');
            }

            const allHeaders = Array.from(table.querySelectorAll('thead tr:last-child th'));

            headersWithFormulas.forEach(header => {
                const formula = header.dataset.formula;
                if (formula) {
                    const colIndex = allHeaders.indexOf(header);
                    if (colIndex > -1) {
                        performCustomFormula(table, colIndex, formula);
                    }
                }
            });

            showToast(`✅ Recalculated all ${headersWithFormulas.length} formula column(s).`, 'success');
        }
    }
},{
    name: 'recalc',
    description: 'Alias for /recalculate. Updates all table calculations.',
    execute: (args) => {
        // This just finds and runs the main /recalculate command's logic
        commands.find(c => c.name === 'recalculate').execute(args);
    }
},
{
    name: 'rc',
    description: 'Alias for /recalculate. Updates all table calculations.',
    execute: (args) => {
        // This also finds and runs the main /recalculate command's logic
        commands.find(c => c.name === 'recalculate').execute(args);
    }
},
// ... rest of the commands
    { name: 'dn', description: 'Delete a note. Usage: /dn [note name]', suggest: 'notes', execute: (args)=>executeWithSmartFind(args,'notes',async (n)=>{const r=findItem(n.id);const c=await showConfirm({title:`Delete "${n.name}"?`,message:'This cannot be undone.',confirmText:'Delete'});if(c){const pA=Array.isArray(r.parent)?r.parent:r.parent.children;pA.splice(r.index,1);showToast(`🗑️ Note deleted.`);if(state.settings.activeNoteId===n.id)state.settings.activeNoteId=null;saveState();buildLunrIndex();render()}})},
    { name: 'df', description: 'Delete folder. Usage: /df [folder name]', suggest: 'folders', execute: (args)=>executeWithSmartFind(args,'folders',async (f)=>{const r=findItem(f.id);const c=await showConfirm({title:`Delete folder "${f.name}"?`,message:'This will delete the folder and <strong>all notes inside</strong>.',confirmText:'Delete'});if(c){const pA=Array.isArray(r.parent)?r.parent:r.parent.children;pA.splice(r.index,1);showToast(`🗑️ Folder deleted.`);if(state.settings.activeCollectionId===f.id)state.settings.activeCollectionId=null;saveState();buildLunrIndex();render()}})},
// --- START: NEW RESEARCH AGENT COMMAND ---
{
    name: 'research',
    description: 'Research brief from multiple notes. Usage: /research [topic]',
    execute: (args) => {
        if (!args) {
            return showToast('❌ Please provide a research topic.', 'error');
        }
        // We will call the new agent function here
        researchAgent(args);
    }
},
// --- START: NEW MEETING ASSISTANT COMMAND ---
{
    name: 'process',
    description: 'Scans meeting notes to extract a summary and action items.',
    execute: (args) => {
        const noteId = state.settings.activeNoteId;
        if (!noteId) {
            return showToast('❌ You must be in a note to process it.', 'error');
        }
        // This will call our new agent function
        meetingAssistantAgent(noteId);
    }
}
// --- END: NEW MEETING ASSISTANT COMMAND ---
// --- END: NEW RESEARCH AGENT COMMAND ---
];

const openCommandPrompt = () => { if (document.activeElement === app.elements.noteEditorBody && window.getSelection().rangeCount > 0) {
        editorSelectionRange = window.getSelection().getRangeAt(0).cloneRange();
    }if(isCommandPromptOpen)return;isCommandPromptOpen=true;commandPromptContainer.classList.remove('hidden');commandInput.value='/';renderSuggestions('/');commandInput.focus();setTimeout(()=>commandInput.setSelectionRange(commandInput.value.length,commandInput.value.length),0) };
const closeCommandPrompt = () => { if(!isCommandPromptOpen)return;isCommandPromptOpen=false;commandPromptContainer.classList.add('hidden');commandSuggestionsContainer.classList.add('hidden');suggestionIndex=-1 };

// REPLACE THE EXISTING FUNCTION WITH THIS ONE
const renderSuggestions = (rawInput) => {
    const input = rawInput.startsWith('/') ? rawInput.slice(1) : rawInput;
    const parts = input.split(' ');
    const commandName = parts[0];
    const argString = parts.slice(1).join(' ');
    const command = commands.find(c => c.name.toLowerCase() === commandName.toLowerCase());

    let suggestionsHTML = '';
    const argQuery = argString.toLowerCase();

    if (commandName.toLowerCase() === 'run') {
        const agentTrigger = parts[1] || '';
        const agentArgQuery = parts.slice(2).join(' ');

        if (!agentTrigger || (state.agents.some(a => a.trigger.startsWith(agentTrigger)) && parts.length < 3)) {
            const matchingAgents = state.agents.filter(a => a.trigger.toLowerCase().startsWith(agentTrigger.toLowerCase()));
            if (matchingAgents.length > 0) {
                 suggestionsHTML = matchingAgents.slice(0, 5).map((agent, index) => `
                    <div class="command-suggestion-item ${index === suggestionIndex ? 'active' : ''}" data-agent-trigger="${agent.trigger}">
                        <div class="flex items-center gap-2"><i data-feather="box" class="w-4 h-4 text-text-secondary"></i><span class="cmd-name">${agent.trigger}</span></div>
                        <span class="cmd-desc">${agent.name}</span>
                    </div>`).join('');
            }
        } else {
            const agent = state.agents.find(a => a.trigger === agentTrigger);
            if (agent && agent.argumentName) {
                const allNotes = getAllNotes(state.collections);
                const fuse = new Fuse(allNotes, { keys: ['name'], threshold: 0.4 });
                const noteSuggestions = fuse.search(agentArgQuery).map(result => result.item);

                if (noteSuggestions.length > 0) {
                     suggestionsHTML = noteSuggestions.slice(0, 5).map((note, index) => `
                        <div class="command-suggestion-item ${index === suggestionIndex ? 'active' : ''}" data-note-argument="${note.name.replace(/"/g, '&quot;')}">
                            <div class="flex items-center gap-2"><i data-feather="file-text" class="w-4 h-4 text-text-secondary"></i><span class="cmd-name truncate">${note.name}</span></div>
                            <span class="cmd-desc">Note Argument</span>
                        </div>`).join('');
                } else {
                     suggestionsHTML = `<div class="p-2 text-sm text-text-tertiary">No notes match "${agentArgQuery}"</div>`;
                }
            }
        }

    } else if (command && command.suggest) {
        let finalSuggestions = [];
        const toSeparator = /\s+to\s+/i;
        const fromSeparator = /\s+from\s+/i;
        
        // --- START: NEW LOGIC FOR CHECKLIST SUGGESTIONS ---
        if (command.suggest.includes('checklists')) {
            const editorBody = app.elements.noteEditorBody;
            const checklists = Array.from(editorBody.querySelectorAll('.checklist-container')).map(cl => ({
                name: cl.querySelector('.checklist-title')?.textContent.trim() || 'Untitled Checklist'
            }));
            const fuse = new Fuse(checklists, { keys: ['name'], threshold: 0.5 });
            finalSuggestions = fuse.search(argQuery).map(result => result.item);

        } else if (command.suggest.includes('checklist_items')) {
            const editorBody = app.elements.noteEditorBody;
            const allItems = [];
            editorBody.querySelectorAll('.checklist-container').forEach(cl => {
                const checklistTitle = cl.querySelector('.checklist-title')?.textContent.trim() || 'Untitled';
                cl.querySelectorAll('.checklist-item-text').forEach(itemEl => {
                    allItems.push({ name: itemEl.textContent, context: `in "${checklistTitle}"` });
                });
            });
            const fuse = new Fuse(allItems, { keys: ['name'], threshold: 0.4 });
            finalSuggestions = fuse.search(argQuery).map(result => result.item);
        
        // --- END: NEW LOGIC FOR CHECKLIST SUGGESTIONS ---

        } else if ((command.name === 'move' || command.name === 'rename' || command.name === 'link') && toSeparator.test(argString)) {
            const targetQuery = argString.split(toSeparator)[1].toLowerCase() || '';
            let itemsToSuggest = (command.suggest === 'notes') ? getAllNotes(state.collections) : [...getAllNotes(state.collections), ...getAllFolders()];
            if (command.name === 'move') itemsToSuggest = getAllFolders();
            const fuse = new Fuse(itemsToSuggest, { keys: ['name'], threshold: 0.5 });
            finalSuggestions = fuse.search(targetQuery).map(result => result.item);
        } else if (command.name === 'unlink' && fromSeparator.test(argString)) {
            const sourceQuery = argString.split(fromSeparator)[1].toLowerCase() || '';
            const fuse = new Fuse(getAllNotes(state.collections), { keys: ['name'], threshold: 0.5 });
            finalSuggestions = fuse.search(sourceQuery).map(result => result.item);
        } else {
            let itemsToSearch = [];
            if (command.suggest.includes('items')) itemsToSearch = [...getAllNotes(state.collections), ...getAllFolders()];
            else if (command.suggest.includes('notes')) itemsToSearch = getAllNotes(state.collections);
            else if (command.suggest.includes('folders')) itemsToSearch = getAllFolders();
            if (itemsToSearch.length > 0) {
                const fuse = new Fuse(itemsToSearch, { keys: ['name'], threshold: 0.5 });
                finalSuggestions = fuse.search(argQuery).map(result => result.item);
            }
        }
        if (finalSuggestions.length > 0) {
            suggestionsHTML = finalSuggestions.slice(0, 5).map((item, index) => {
                // --- START: NEW LOGIC FOR DISPLAYING CHECKLIST SUGGESTIONS ---
                const icon = item.type === 'folder' ? 'folder' : (command.suggest.includes('checklist') ? 'check-square' : 'file-text');
                const context = item.context ? `<span class="cmd-desc">${item.context}</span>` : '';
                // --- END: NEW LOGIC FOR DISPLAYING CHECKLIST SUGGESTIONS ---
                return `
                <div class="command-suggestion-item ${index === suggestionIndex ? 'active' : ''}" data-item-name="${item.name.replace(/"/g, '&quot;')}">
                    <div class="flex items-center gap-2 min-w-0"> <i data-feather="${icon}" class="w-4 h-4 text-text-secondary flex-shrink-0"></i> <span class="cmd-name truncate">${item.name}</span> </div>
                    ${context}
                </div>`;
            }).join('');
        }
    } else {
        const lowerCaseCommandName = commandName.toLowerCase();
        const filteredCommands = commands.filter(cmd => cmd.name.toLowerCase().startsWith(lowerCaseCommandName)).slice(0, 5);
        if (filteredCommands.length > 0) {
            suggestionsHTML = filteredCommands.map((cmd, index) => `
                <div class="command-suggestion-item ${index === suggestionIndex ? 'active' : ''}" data-command-name="${cmd.name}">
                    <div class="flex items-center gap-3"><span class="cmd-name">/${cmd.name}</span></div>
                    <span class="cmd-desc">${cmd.description}</span>
                </div>`).join('');
        }
    }

    if (suggestionsHTML) {
        commandSuggestionsContainer.innerHTML = suggestionsHTML;
        commandSuggestionsContainer.classList.remove('hidden');
        feather.replace();
    } else {
        commandSuggestionsContainer.classList.add('hidden');
    }
    suggestionIndex = -1;
};

const executeCommand = (inputValue) => {
    const cleanInput = inputValue.slice(1).trim();
    if (!cleanInput) { closeCommandPrompt(); return; }
    const parts = cleanInput.split(' ');
    const commandName = parts[0];
    const args = parts.slice(1).join(' ');
    // This comparison is now case-insensitive
    const command = commands.find(c => c.name.toLowerCase() === commandName.toLowerCase());
    if (command) command.execute(args);
    else showToast(`❌ Command not found: ${commandName}`, 'error');
    closeCommandPrompt();
};

document.addEventListener('keydown', (e) => {
    // --- START: Modal Keyboard Shortcuts ---
    const confirmModal = document.getElementById('confirm-modal');
    if (!confirmModal.classList.contains('hidden')) {
        if (e.key === 'Enter') { e.preventDefault(); document.getElementById('confirm-confirm-btn').click(); }
        else if (e.key === 'Escape') { e.preventDefault(); document.getElementById('confirm-cancel-btn').click(); }
        return;
    }
    // --- END: Modal Keyboard Shortcuts ---

    if ((e.metaKey || e.ctrlKey) && e.key === '/') { e.preventDefault(); isCommandPromptOpen ? closeCommandPrompt() : openCommandPrompt(); }
    if (!isCommandPromptOpen) { return; }
    if (e.key === 'Escape') { e.preventDefault(); closeCommandPrompt(); return; }

    const suggestions = Array.from(commandSuggestionsContainer.querySelectorAll('.command-suggestion-item'));
    const activeSuggestion = suggestions[suggestionIndex];

    // REPLACE THE EXISTING FUNCTION WITH THIS ONE
const completeSuggestion = (suggestionEl) => {
    const commandInput = document.getElementById('command-input');
    const currentInput = commandInput.value.slice(1);
    const parts = currentInput.split(' ');
    const commandName = parts[0];

    const commandSuggestion = suggestionEl.dataset.commandName;
    const itemSuggestion = suggestionEl.dataset.itemName;
    const agentTrigger = suggestionEl.dataset.agentTrigger;
    const noteArgument = suggestionEl.dataset.noteArgument;

    let completedValue = '';

    if (commandSuggestion) {
        // User is tabbing on a command name (e.g., /mo -> /move )
        completedValue = `/${commandSuggestion} `;
    } else if (agentTrigger) {
        // User is tabbing on an agent trigger for the /run command
        completedValue = `/run ${agentTrigger} `;
    } else if (itemSuggestion) {
        // This is the main logic for multi-argument commands
        const commandDef = commands.find(c => c.name === commandName);
        const toSeparator = /\s+to\s+/i;
        const fromSeparator = /\s+from\s+/i;

        // Wrap names with spaces in quotes for accurate parsing
        const safeItemSuggestion = itemSuggestion.includes(' ') ? `"${itemSuggestion}"` : itemSuggestion;

        if ((commandDef?.name === 'move' || commandDef?.name === 'link' || commandDef?.name === 'rename') && toSeparator.test(currentInput)) {
            // Completing the SECOND argument (after "to")
            const base = currentInput.split(toSeparator)[0];
            completedValue = `/${base} to ${safeItemSuggestion}`;
        } else if (commandDef?.name === 'unlink' && fromSeparator.test(currentInput)) {
            // Completing the SECOND argument (after "from")
            const base = currentInput.split(fromSeparator)[0];
            completedValue = `/${base} from ${safeItemSuggestion}`;
        } else {
            // Completing the FIRST argument
            if (commandDef?.name === 'move' || commandDef?.name === 'link' || commandDef?.name === 'rename') {
                completedValue = `/${commandName} ${safeItemSuggestion} to `;
            } else if (commandDef?.name === 'unlink') {
                completedValue = `/${commandName} ${safeItemSuggestion} from `;
            } else {
                // For all other single-argument commands (/go, /dn, etc.)
                completedValue = `/${commandName} ${safeItemSuggestion}`;
            }
        }
    } else if (noteArgument) {
         // This handles the specific case for /run agent [argument]
         completedValue = `/run ${parts[1]} ${noteArgument}`;
    }


    if (completedValue) {
        commandInput.value = completedValue;
        // Move cursor to the end
        const end = commandInput.value.length;
        commandInput.setSelectionRange(end, end);
        // Refresh suggestions based on the new input
        renderSuggestions(commandInput.value);
    }
};

    if (e.key === 'Tab') {
        e.preventDefault();
        const suggestionToUse = activeSuggestion || suggestions[0];
        if (suggestionToUse) {
            completeSuggestion(suggestionToUse);
        }
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeSuggestion) {
            // If a suggestion is highlighted, complete it first before executing
            completeSuggestion(activeSuggestion);
        }
        executeCommand(commandInput.value);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (suggestions.length === 0) return;
        if(activeSuggestion) activeSuggestion.classList.remove('active');
        const direction = e.key === 'ArrowDown' ? 1 : -1;
        suggestionIndex = (suggestionIndex + direction + suggestions.length) % suggestions.length;
        suggestions[suggestionIndex].classList.add('active');
    }
});

commandInput.addEventListener('input', () => { if (!commandInput.value.startsWith('/')) commandInput.value = '/'; renderSuggestions(commandInput.value); });
commandSuggestionsContainer.addEventListener('click', (e) => { const item = e.target.closest('.command-suggestion-item'); if(item){ const cmdName=commandInput.value.slice(1).split(' ')[0]; const argStr=commandInput.value.slice(1).substring(cmdName.length).trim(); let finalCmd; if(item.dataset.itemName){ const toSep=/\s+to\s+/i; const fromSep=/\s+from\s+/i; if((cmdName==='move'||cmdName==='link'||cmdName==='rename')&&toSep.test(argStr)){finalCmd=`/${cmdName} ${argStr.split(toSep)[0]} to ${item.dataset.itemName}`}else if(cmdName==='unlink'&&fromSep.test(argStr)){finalCmd=`/${cmdName} ${argStr.split(fromSep)[0]} from ${item.dataset.itemName}`}else if(cmdName==='go'&&argStr.startsWith('#')){finalCmd=`/${cmdName} ${argStr.split(' ')[0]} ${item.dataset.itemName}`}else{finalCmd=`/${cmdName} ${item.dataset.itemName}`}}else if(item.dataset.tagName){finalCmd=`/go ${item.dataset.tagName}`}else{finalCmd=`/${item.dataset.commandName}`}executeCommand(finalCmd)} });
document.addEventListener('click', (e) => { if (isCommandPromptOpen && !commandPromptContainer.contains(e.target)) closeCommandPrompt(); });

document.getElementById('help-close-btn').addEventListener('click', () => closeModal(document.getElementById('help-modal')));
document.getElementById('linked-notes-close-btn').addEventListener('click', () => closeModal(document.getElementById('linked-notes-modal')));
document.getElementById('linked-notes-modal').addEventListener('click', (e) => {
    const link = e.target.closest('.linked-note-jump');
    if (link) {
        e.preventDefault();
        const noteId = link.dataset.noteId;
        const noteName = findItem(noteId)?.item.name;
        if(noteName) {
            closeModal(document.getElementById('linked-notes-modal'));
            executeCommand(`/go ${noteName}`);
        }
    }
});
// --- END: SLASH COMMAND CONSOLE ---

// --- END: SLASH COMMAND CONSOLE ---

// --- END: SLASH COMMAND CONSOLE ---
// --- END: SLASH COMMAND CONSOLE ---

// --- END: SLASH COMMAND CONSOLE ---

// --- END: SLASH COMMAND CONSOLE ---
// --- Template Modal Listeners ---
// --- Manage Templates Modal Listeners ---
document.getElementById('manage-templates-btn').addEventListener('click', () => {
    closeModal(document.getElementById('template-modal'));
    renderManageTemplatesModal();
    openModal(document.getElementById('manage-templates-modal'));
});

document.getElementById('manage-templates-close-btn').addEventListener('click', () => {
    closeModal(document.getElementById('manage-templates-modal'));
});

document.getElementById('manage-templates-done-btn').addEventListener('click', () => {
    closeModal(document.getElementById('manage-templates-modal'));
});

document.getElementById('manage-template-list').addEventListener('click', (e) => {
    const templateId = e.target.closest('[data-template-id]')?.dataset.templateId;
    if (!templateId) return;

    if (e.target.closest('.manage-template-rename-btn')) {
        renameTemplate(templateId);
    } else if (e.target.closest('.manage-template-delete-btn')) {
        deleteTemplate(templateId);
    }
});
// --- Share Modal Listeners ---
document.getElementById('share-invite-btn').addEventListener('click', handleInviteCollaborator);
document.getElementById('share-email-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleInviteCollaborator();
});
document.getElementById('share-modal-close-btn').addEventListener('click', () => closeModal(document.getElementById('share-modal')));
document.getElementById('share-done-btn').addEventListener('click', () => closeModal(document.getElementById('share-modal')));

document.getElementById('share-collaborators-list').addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-collaborator-btn')) {
        const uid = e.target.dataset.uid;
        handleRemoveCollaborator(uid);
    }
});
document.getElementById('template-modal-close-btn').addEventListener('click', () => {
    closeModal(document.getElementById('template-modal'));
});

document.getElementById('template-list-container').addEventListener('click', (e) => {
    const item = e.target.closest('.template-item');
    if (item) {
        const templateId = item.dataset.templateId;
        const template = state.templates.find(t => t.id === templateId);
        if (template) {
            createNewNote(true, template);
            closeModal(document.getElementById('template-modal'));
        }
    }
});
                // --- Source Snippet Click Listener ---
document.getElementById('global-ai-modal').addEventListener('click', (e) => {
    const link = e.target.closest('.source-snippet-link');
    if (link) {
        e.preventDefault();
        const noteId = link.dataset.noteId;
        if (noteId) {
            // Logic to switch to the note
            state.settings.activeNoteId = noteId;
            const { parent } = findItem(noteId);
            state.settings.activeCollectionId = (Array.isArray(parent)) ? null : parent.id;
            state.settings.activeTag = null;
            saveState();
            render();
            // Close the modal
            closeModal(document.getElementById('global-ai-modal'));
        }
    }
});
                // --- Copy Button Listeners ---
// --- Copy Button Listeners ---
document.getElementById('summary-copy-btn').addEventListener('click', () => {
    const content = document.getElementById('summary-content').innerText;
    navigator.clipboard.writeText(content)
        .then(() => showToast('Summary copied!', 'success'))
        .catch(() => showToast('Failed to copy.', 'error'));
});

// This now uses the correct ID for the button in the "Ask Your Notes" modal footer
document.getElementById('global-ai-copy-btn-footer').addEventListener('click', () => {
    const content = document.getElementById('global-ai-answer').innerText;
    navigator.clipboard.writeText(content)
        .then(() => showToast('Answer copied!', 'success'))
        .catch(() => showToast('Failed to copy.', 'error'));
});
                // --- Global AI Q&A Listeners ---
const openGlobalAIModal = () => {
    // This now ONLY clears the input field, leaving the previous answer and sources visible.
    document.getElementById('global-ai-input').value = '';

    // It also resets the 'Ask' button so you can submit a new question.
    const askBtn = document.getElementById('global-ai-ask-btn');
    if (askBtn) {
        askBtn.disabled = false;
        askBtn.querySelector('span').textContent = 'Ask';
    }

    openModal(document.getElementById('global-ai-modal'));
    feather.replace();
};
document.getElementById('global-ai-btn').addEventListener('click', openGlobalAIModal); // Desktop button
document.getElementById('mobile-global-ai-btn').addEventListener('click', openGlobalAIModal); // Mobile button


document.getElementById('mobile-global-ai-btn').addEventListener('click', () => { // Mobile button
    document.getElementById('global-ai-input').value = '';
    document.getElementById('global-ai-answer-container').classList.add('hidden');
    openModal(document.getElementById('global-ai-modal'));
    feather.replace();
});

document.getElementById('global-ai-close-btn').addEventListener('click', () => {
    closeModal(document.getElementById('global-ai-modal'));
});

document.getElementById('global-ai-ask-btn').addEventListener('click', handleGlobalAIQuery);
                // --- Global AI Q&A Listeners ---
document.getElementById('global-ai-btn').addEventListener('click', () => {
    document.getElementById('global-ai-input').value = '';
    document.getElementById('global-ai-answer-container').classList.add('hidden');
    openModal(document.getElementById('global-ai-modal'));
    feather.replace();
});

document.getElementById('global-ai-close-btn').addEventListener('click', () => {
    closeModal(document.getElementById('global-ai-modal'));
});

document.getElementById('global-ai-ask-btn').addEventListener('click', handleGlobalAIQuery);
                if (hasInitialized) return;
                app.modals.apiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') app.modals.apiKeyConfirmBtn.click();
});

document.getElementById('global-ai-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleGlobalAIQuery();
    }
});

addPropertyModal.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('create-property-btn').click();
    }
});

document.getElementById('checklist-edit-modal').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('input[type="text"]')) {
        e.preventDefault();
        document.getElementById('checklist-modal-add-item-btn').click();
    }
});

document.getElementById('table-creator-modal').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('table-create-btn').click();
    }
});
// START: Corrected Mobile Header Hiding Logic
// START: Corrected Mobile Header Hiding Logic
const handleEditorActivation = () => {
    // This logic should only run on mobile devices when the user intends to edit.
    if (window.innerWidth < 768) {
        document.body.classList.add('mobile-editor-active');
        document.getElementById('main-header')?.classList.add('hidden');
        document.getElementById('mobile-sticky-toolbar')?.classList.remove('hidden');
    }
};

// Use 'focus' to detect when the user is ready to type (keyboard appears)
app.elements.noteEditorBody.addEventListener('focus', handleEditorActivation);

// We keep the blur listener as is, it's correct.
app.elements.noteEditorBody.addEventListener('blur', () => {
    if (window.innerWidth < 768) {
        document.body.classList.remove('mobile-editor-active');
        document.getElementById('main-header')?.classList.remove('hidden');
        document.getElementById('mobile-sticky-toolbar')?.classList.add('hidden');
    }
});
// END: Corrected Mobile Header Hiding Logic
// END: Corrected Mobile Header Hiding Logic
                // START: Mobile Header Restore Fix
app.elements.noteEditorBody.addEventListener('blur', () => {
    // On mobile, when the editor loses focus (e.g., keyboard dismissed), restore the main header.
    if (window.innerWidth < 768) {
        document.body.classList.remove('mobile-editor-active');
        document.getElementById('main-header')?.classList.remove('hidden');
        document.getElementById('mobile-sticky-toolbar')?.classList.add('hidden');
    }
});
// END: Mobile Header Restore Fix
// START: Mobile Header Hide on Edit Resume Fix

// END: Mobile Header Hide on Edit Resume Fix
hasInitialized = true;
                
                // Add this inside the init() function
// Located inside the init() function
document.getElementById('chatbot-toggle-btn').addEventListener('click', () => {
    // Invert the boolean value
    state.settings.chatbotVisible = !state.settings.chatbotVisible;
    // Save the new state
    saveState();
    // Re-render the entire UI with the new state
    render();
});
document.getElementById('toggle-properties-btn').addEventListener('click', () => {
    state.settings.propertiesVisible = !state.settings.propertiesVisible;
    saveState();
    render();
});
                // --- START: Inline Toolbar Scroll Logic ---
const toolbarButtons = document.getElementById('inline-toolbar-buttons');
const scrollLeftBtn = document.getElementById('toolbar-scroll-left');
const scrollRightBtn = document.getElementById('toolbar-scroll-right');

const handleToolbarScroll = () => {
    scrollLeftBtn.addEventListener('click', () => {
        toolbarButtons.scrollLeft -= 70;
    });
    scrollRightBtn.addEventListener('click', () => {
        toolbarButtons.scrollLeft += 70;
    });
};

if (window.innerWidth < 768) {
    handleToolbarScroll();
}
// --- END: Inline Toolbar Scroll Logic ---
                // Add these listeners for the new table modal
document.getElementById('table-cancel-btn').addEventListener('click', () => {
    closeModal(document.getElementById('table-creator-modal'));
});
// This is the corrected event listener for the create button
// REPLACE THE OLD 'table-create-btn' LISTENER WITH THIS
// REPLACE THE OLD 'table-create-btn' LISTENER
// REPLACE 'table-create-btn' LISTENER
document.getElementById('table-create-btn').addEventListener('click', () => {
    const rows = parseInt(document.getElementById('table-rows').value) || 3;
    const cols = parseInt(document.getElementById('table-cols').value) || 2;

    let tableHTML = '<table style="width:100%"><thead>';
    // Add Filter Row with Icon
    tableHTML += `<tr><th colspan="${cols}" contenteditable="false"><div class="table-filter-wrapper"><i data-feather="search" class="filter-icon"></i><input class="table-filter-input" placeholder="Filter table..."/></div></th></tr>`;
    // Add Header Row
    tableHTML += '<tr>';
    for (let i = 0; i < cols; i++) {
        tableHTML += `<th class="sortable-header" data-sort-dir="none" contenteditable="true">Header ${i + 1}</th>`;
    }
    tableHTML += '</tr></thead><tbody>';
    // Add Data Rows
    for (let i = 0; i < rows; i++) {
        tableHTML += '<tr>';
        for (let j = 0; j < cols; j++) {
            tableHTML += '<td contenteditable="true"></td>';
        }
        tableHTML += '</tr>';
    }
    tableHTML += '</tbody></table><p><br></p>';

    restoreSelectionAndExec(() => document.execCommand('insertHTML', false, tableHTML));
    closeModal(document.getElementById('table-creator-modal'));
    feather.replace(); // This is important to render the new icon
});
                setupInNoteSearchListeners();

                
                // --- Logic for File Attachments ---
// --- Logic for File Attachments ---
const fileUploadInput = document.getElementById('file-upload-input');
const mobileAttachBtn = document.getElementById('mobile-attach-file-btn');
const desktopAttachBtn = document.getElementById('desktop-attach-file-btn');

const triggerFileUpload = () => fileUploadInput.click();

if (mobileAttachBtn) mobileAttachBtn.addEventListener('click', triggerFileUpload);
if (desktopAttachBtn) desktopAttachBtn.addEventListener('click', triggerFileUpload);
// --- Logic for Toolbar Toggle ---
const toggleToolbarBtn = document.getElementById('toggle-toolbar-btn');
const expandableButtons = document.getElementById('expandable-toolbar-buttons');
const toggleIcon = document.getElementById('toolbar-toggle-icon');

toggleToolbarBtn.addEventListener('click', () => {
    const isHidden = expandableButtons.classList.contains('hidden');
    if (isHidden) {
        expandableButtons.classList.remove('hidden');
        expandableButtons.classList.add('flex'); // Use flex to show the items
        toggleIcon.setAttribute('data-feather', 'chevron-left');
    } else {
        expandableButtons.classList.add('hidden');
        expandableButtons.classList.remove('flex');
        toggleIcon.setAttribute('data-feather', 'chevron-right');
    }
    feather.replace(); // This redraws the chevron icon
});
const titleTextarea = app.elements.noteEditorTitle;
                titleTextarea.addEventListener('input', () => {
                    titleTextarea.style.height = 'auto';
                    titleTextarea.style.height = (titleTextarea.scrollHeight) + 'px';
                });
// Add this new event listener for the Settings panel
                document.getElementById('toggle-settings-btn').addEventListener('click', () => {
                    const settingsContainer = document.getElementById('settings-list-container');
                    const settingsButton = document.getElementById('toggle-settings-btn');
                    settingsContainer.classList.toggle('collapsed');
                    settingsButton.classList.toggle('collapsed');
                    // You might want to save this state, similar to tagsCollapsed
                    // For now, it will reset on page load.
                    feather.replace();
                });
app.elements.toggleTagsBtn.addEventListener('click', () => {
    state.settings.tagsCollapsed = !state.settings.tagsCollapsed;
    saveState();
    renderTagsState();
    feather.replace(); // To ensure the icon animation is smooth
});
fileUploadInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleFileUpload(file);
    }
    // Reset the input so you can upload the same file again if needed
    e.target.value = '';
});
                document.getElementById('header-share-btn').addEventListener('click', () => handleShareNote());
                await loadState();
                await migrateVersionsToFirestore(); // This will run the one-time data migration if needed.
                buildLunrIndex();
                setupSharedNoteListener();
                setupInvitationListener();
                
                initSpeechRecognition();
                initClipper();
                initCalculator();
                initHeadingNav();
                // --- START: Listeners for the Agent Save Modal ---
document.getElementById('save-agent-confirm-btn').addEventListener('click', handleSaveAgentConfirm);
document.getElementById('save-agent-cancel-btn').addEventListener('click', () => {
    closeModal(document.getElementById('save-agent-modal'));
});
// --- END: Listeners for the Agent Save Modal ---
                initAgentForgeListeners(); // <-- Add this line right after
                initAgentManagementListeners();

                initTimer()
                

                // Logic for the new AI buttons in the main header
const headerSummarizeBtn = document.getElementById('header-summarize-btn');
const headerQuizBtn = document.getElementById('header-quiz-btn');

const handleHeaderAIAction = (action) => {
    const noteId = state.settings.activeNoteId;
    // --- FIX STARTS HERE ---
    // Get the full note object from the cache instead of the sidebar stub.
        const note = window.noteCache[noteId] ? { id: noteId, ...window.noteCache[noteId] } : null;

    // --- FIX ENDS HERE ---

    if (note) {
        if (action === 'share') {
            handleShareNote(note);
            return;
        }

        const plainContent = (note.content || '').replace(/<[^>]*>?/gm, '').trim();
        if (plainContent) {
            if (action === 'summarize') {
                handleSummarize(plainContent);
            } else if (action === 'quiz') {
                handleGenerateQuiz(plainContent, note);
            } else if (action === 'flashcard') {
                handleFlashcardMode(note);
            }
        } else {
            showToast("Note is empty.", "info");
        }
    }
};

// --- START: Consolidated Header Action Listeners ---
document.getElementById('header-summarize-btn').addEventListener('click', () => handleHeaderAIAction('summarize'));
document.getElementById('header-quiz-btn').addEventListener('click', () => handleHeaderAIAction('quiz'));
document.getElementById('header-flashcard-btn').addEventListener('click', () => handleHeaderAIAction('flashcard'));

// This is the single, correct listener for the share button
document.getElementById('header-share-btn').addEventListener('click', () => handleHeaderAIAction('share')); 

// This handles the collaboration button
document.getElementById('header-collaborate-btn').addEventListener('click', openShareModal);
// --- START: Tap-to-Save Indicator Logic ---
document.getElementById('save-indicator').addEventListener('click', () => {
    if (isNoteDirty) {
        performImmediateSave();
        showToast('✅ Saved', 'success');
    }
});
// --- END: Tap-to-Save Indicator Logic ---
// --- END: Consolidated Header Action Listeners ---
                
                const renderer = new marked.Renderer();
                renderer.code = function(code, language) {
                    const validLang = language && hljs.getLanguage(language) ? language : 'plaintext';
                    const highlightedCode = hljs.highlight(code, { language: validLang, ignoreIllegals: true }).value;
                    return `
                        <div class="code-block-wrapper">
                            <div class="code-block-header">
                                <span class="lang-name">${validLang}</span>
                                <div class="flex items-center gap-2">
                                    <!-- THIS IS THE NEW EXIT BUTTON -->
                                    <button class="exit-code-btn" title="Exit Code Block">
                                        <i data-feather="arrow-down-left" class="w-4 h-4"></i>
                                        <span>Exit</span>
                                    </button>
                                    <button class="copy-code-btn" title="Copy Code">
                                        <i data-feather="copy" class="w-4 h-4"></i>
                                        <span>Copy</span>
                                    </button>
                                    <button class="delete-block-btn" title="Delete Block">
                                        <i data-feather="trash-2" class="w-4 h-4"></i>
                                    </button>
                                </div>
                            </div>
                            <pre><code class="hljs language-${validLang}">${highlightedCode}</code></pre>
                        </div>
                    `;
                };

                marked.setOptions({
                    renderer: renderer,
                    gfm: true,
                    breaks: true,
                });

                

                app.elements.sortOrderSelect.value = state.settings.listSortOrder;
                
                app.elements.themeToggle.addEventListener('click', () => {
                    // ADD THIS NEW EVENT LISTENER for the profile dropdown
                const profileButton = document.getElementById('profile-button');
                const profileDropdown = document.getElementById('profile-dropdown');
                const signOutLink = document.getElementById('sign-out-link');

                if (profileButton && profileDropdown) {
                    profileButton.addEventListener('click', (e) => {
                        e.stopPropagation(); // Prevents the document click from firing immediately
                        profileDropdown.classList.toggle('hidden');
                    });
                }
                
                if(signOutLink) {
                    signOutLink.addEventListener('click', async (e) => {
                        e.preventDefault();
                        try {
                            await signOut(window.auth);
                            console.log('User signed out successfully.');
                            // onAuthStateChanged will handle hiding the app and showing the login form.
                        } catch (error) {
                            console.error('Sign out error:', error);
                            showToast('Error signing out.', 'error');
                        }
                    });
                }

                // Hides dropdown if you click anywhere else
                document.addEventListener('click', (e) => {
                    if (profileButton && !profileButton.contains(e.target) && profileDropdown && !profileDropdown.classList.contains('hidden')) {
                        profileDropdown.classList.add('hidden');
                    }
                });
                    const themes = ['reputify', 'light', 'dark'];
                    const currentThemeIndex = themes.indexOf(state.settings.theme);
                    state.settings.theme = themes[(currentThemeIndex + 1) % themes.length];
                    localStorage.setItem('codex-notes-theme', state.settings.theme); 
                    saveState();
                    renderTheme();
                    feather.replace();
                });
                
                app.elements.sidebarToggleBtn.addEventListener('click', () => {
                    state.settings.sidebarCollapsed = !state.settings.sidebarCollapsed;
                    saveState();
                    renderSidebarState();
                });
                
                
                // =================================================================
// START: REPLACEMENT JAVASCRIPT FOR NEW MOBILE MENU
// =================================================================

// Get references to our new menu elements
const notionMenu = document.getElementById('notion-style-mobile-menu');
const notionMenuContent = document.getElementById('notion-menu-content');
const notionMenuCloseBtn = document.getElementById('mobile-menu-close-btn');

/**
 * Dynamically builds the content for our new Notion-style menu.
 */
// REPLACE the entire renderNotionStyleMenu function
// =================================================================
// START: CORRECTED JAVASCRIPT FOR FOLDER NAVIGATION
// =================================================================

/**
 * Dynamically builds the content for our new Notion-style menu.
 */
// =================================================================
// START: REPLACEMENT FUNCTION
// =================================================================
const renderNotionStyleMenu = () => {
    const user = window.auth.currentUser;
    if (user && user.email) {
        document.getElementById('menu-user-initial').textContent = user.email.charAt(0).toUpperCase();
        document.getElementById('menu-user-email').textContent = user.email;
        document.getElementById('dropdown-user-email-display').textContent = user.email;
    }
    const allNotes = getAllNotes(state.collections);
    const recentNotes = [...allNotes]
        .sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt))
        .slice(0, 5);
    let jumpBackHTML = '';
    if (recentNotes.length > 0) {
        jumpBackHTML = `
            <h3 class="notion-menu-section-header">Jump back in</h3>
            <div class="jump-back-in-grid">
                ${recentNotes.map(note => `
                    <a href="#" class="recent-note-card" data-id="${note.id}" data-action="navigate-note">
                        <i data-feather="file-text" class="w-5 h-5"></i>
                        <span class="note-name">${note.name}</span>
                    </a>
                `).join('')}
            </div>`;
    }

    const buildPrivateList = (collections = state.collections, level = 0, parentId = null) => {
        return collections.map(item => {
            const isFolder = item.type === 'folder';
            
            // --- THIS IS THE NEW, MORE RELIABLE HTML STRUCTURE ---
            let itemHTML = `
                <li data-id="${item.id}" class="collection-item-wrapper rounded-md">
                    <div class="collection-item flex items-center justify-between gap-2 p-2 rounded-md hover:bg-bg-pane-dark" style="padding-left: ${8 + level * 16}px;">
                        
                        <div class="flex items-center gap-2 flex-grow min-w-0">
                            ${isFolder ? `<a href="#" class="expander-btn -ml-1 p-1" data-action="toggle-expand"><i data-feather="chevron-right" class="chevron w-4 h-4 flex-shrink-0 text-text-tertiary ${item.expanded ? 'open' : ''}"></i></a>` : '<div class="w-6 h-6 flex-shrink-0"></div>'}
                            <a href="#" class="flex items-center gap-2 flex-grow min-w-0" data-action="${isFolder ? 'navigate-folder' : 'navigate-note'}">
                                <i data-feather="${isFolder ? 'folder' : 'file-text'}" class="w-4 h-4 flex-shrink-0 text-text-secondary"></i>
                                <span class="truncate">${item.name}</span>
                            </a>
                        </div>

                        <button class="add-note-btn" data-action="add-note-here" data-parent-id="${isFolder ? item.id : parentId}" title="Add New Note Here">
                            <i data-feather="plus" class="w-4 h-4"></i>
                        </button>

                    </div>`;

            if (isFolder && item.expanded && item.children && item.children.length > 0) {
                itemHTML += `<ul class="collection-children">${buildPrivateList(item.children, level + 1, item.id)}</ul>`;
            } else if (isFolder && item.expanded) {
                itemHTML += `<p class="pl-12 py-1 text-sm text-text-tertiary">No notes inside</p>`;
            }
            itemHTML += `</li>`;
            return itemHTML;
        }).join('');
    };

    document.getElementById('jump-back-in-section').innerHTML = jumpBackHTML;
    document.getElementById('private-section').innerHTML = `
        <h3 class="notion-menu-section-header">All Notes</h3>
        <ul class="space-y-1">${buildPrivateList()}</ul>
    `;
    feather.replace();
};
// =================================================================
// END: REPLACEMENT FUNCTION
// =================================================================

// --- THIS IS THE CORRECTED CLICK HANDLER FOR THE MENU ---
// REPLACE your current notionMenu 'click' listener with this one


// =================================================================
// END: CORRECTED JAVASCRIPT
// =================================================================
/**
 * Opens the new mobile menu.
 */
const openNotionStyleMenu = () => {
    renderNotionStyleMenu(); // Build the content just before showing
    notionMenu.classList.add('open');
};

/**
 * Closes the new mobile menu.
 */
const closeNotionStyleMenu = () => {
    notionMenu.classList.remove('open');
};
// =================================================================
// START: NEW MOBILE SETTINGS POPUP JAVASCRIPT
// =================================================================
const settingsPopup = document.getElementById('mobile-settings-popup');

/**
 * Opens and populates the mobile settings view.
 */
const openMobileSettingsPopup = () => {
    // 1. Update Theme Button state
    const currentTheme = state.settings.theme;
    const themeIcon = document.getElementById('mobile-theme-icon');
    const themeText = document.getElementById('mobile-theme-text');
    if (currentTheme === 'dark') {
        themeIcon.setAttribute('data-feather', 'moon');
        themeText.textContent = 'Dark Theme';
    } else if (currentTheme === 'reputify') {
        themeIcon.setAttribute('data-feather', 'star');
        themeText.textContent = 'Reputify Theme';
    } else {
        themeIcon.setAttribute('data-feather', 'sun');
        themeText.textContent = 'Light Theme';
    }

    // 2. Update Toggle Switch states
    const chatbotToggle = document.querySelector('.toggle-switch[data-setting="chatbotVisible"]');
    chatbotToggle.classList.toggle('active', state.settings.chatbotVisible);

    const propertiesToggle = document.querySelector('.toggle-switch[data-setting="propertiesVisible"]');
    // The logic is inverted for "Hide Properties", so we check for NOT visible
    propertiesToggle.classList.toggle('active', !state.settings.propertiesVisible);

    // 3. Render icons and show the popup
    feather.replace();
    settingsPopup.classList.add('open');
};

/**
 * Closes the mobile settings view.
 */
const closeMobileSettingsPopup = () => {
    settingsPopup.classList.remove('open');
};
// =================================================================
// START: NEW MOBILE TAGS POPUP JAVASCRIPT
// =================================================================
const tagsPopup = document.getElementById('mobile-tags-popup');

/**
 * Opens and populates the mobile tags view.
 */
const openMobileTagsPopup = () => {
    const tagsContent = document.getElementById('mobile-tags-content');
    // Re-use the HTML from the original desktop tags list for consistency
    const originalTagsHTML = app.containers.tagList.innerHTML;
    tagsContent.innerHTML = `<div class="p-2 space-y-1">${originalTagsHTML}</div>`;
    
    feather.replace();
    tagsPopup.classList.add('open');
};

/**
 * Closes the mobile tags view.
 */
const closeMobileTagsPopup = () => {
    tagsPopup.classList.remove('open');
};

// --- Event Listeners for the new Tags Popup ---

// Listener to open the popup from the main menu footer
document.getElementById('mobile-menu-tags-btn').addEventListener('click', openMobileTagsPopup);

// Listener for the back button inside the popup
document.getElementById('mobile-tags-back-btn').addEventListener('click', closeMobileTagsPopup);

// Listener to handle clicking a tag inside the new popup
document.getElementById('mobile-tags-content').addEventListener('click', (e) => {
    const tagItem = e.target.closest('.tag-filter-item');
    if (tagItem) {
        e.preventDefault();
        const tagName = tagItem.dataset.tag;
        // Simulate a click on the original tag to reuse existing logic
        const originalTag = app.containers.tagList.querySelector(`[data-tag="${tagName}"]`);
        if (originalTag) {
            originalTag.click();
        }
        // Close both the tags popup and the main menu to show the results
        closeMobileTagsPopup();
        closeNotionStyleMenu();
    }
});
// =================================================================
// END: NEW MOBILE TAGS POPUP JAVASCRIPT
// =================================================================
// --- Event Listeners for the new Settings Popup ---

// Listener to open the popup from the main menu footer
document.getElementById('mobile-menu-settings-btn').addEventListener('click', openMobileSettingsPopup);

// Listener for the back button inside the popup
document.getElementById('mobile-settings-back-btn').addEventListener('click', closeMobileSettingsPopup);

// Listener for all buttons inside the settings content area
document.getElementById('mobile-settings-content').addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (button) {
        // --- Re-use existing logic from the desktop sidebar ---
        if (button.id === 'mobile-theme-toggle') {
            document.getElementById('theme-toggle').click();
            // Re-render the popup to reflect the new theme name
            openMobileSettingsPopup(); 
        } else if (button.id === 'mobile-bookmarklet-btn') {
            document.getElementById('bookmarklet-info-btn').click();
        } else {
            const action = button.dataset.action;
            if (action) {
                // For Import/Export, find the original button by its data-action and click it
                document.querySelector(`#settings-panel button[data-action="${action}"]`)?.click();
            }
        }
    }

    // --- Handle clicks on the toggle switches ---
    const toggle = e.target.closest('.toggle-switch');
    if (toggle) {
        const settingKey = toggle.dataset.setting;
        if (settingKey === 'chatbotVisible') {
            state.settings.chatbotVisible = !state.settings.chatbotVisible;
            toggle.classList.toggle('active', state.settings.chatbotVisible);
        } else if (settingKey === 'propertiesVisible') {
            // "Hide Properties" is an inverted toggle
            state.settings.propertiesVisible = !state.settings.propertiesVisible;
            toggle.classList.toggle('active', !state.settings.propertiesVisible);
        }
        saveState();
        render(); // Re-render main app to show/hide elements
    }
});
// =================================================================
// END: NEW MOBILE SETTINGS POPUP JAVASCRIPT
// =================================================================
// --- EVENT LISTENERS ---
// ADD ALL THIS NEW JAVASCRIPT CODE

// --- Profile Dropdown Logic ---
const profileActivator = document.getElementById('mobile-menu-profile-activator');
const profileDropdown = document.getElementById('mobile-profile-dropdown');
const mobileSignOutLink = document.getElementById('mobile-sign-out-link');

profileActivator.addEventListener('click', (e) => {
    e.stopPropagation();
    profileDropdown.classList.toggle('hidden');
    if (!profileDropdown.classList.contains('hidden')) {
        feather.replace(); // Re-render icon if shown
    }
});

// Use the existing sign-out link in the main app to avoid duplicating logic
mobileSignOutLink.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('sign-out-link').click();
});

// --- New Footer Button Logic ---
document.getElementById('mobile-menu-add-folder-btn').addEventListener('click', () => {
    // This re-uses the existing new collection logic from the main app!
    app.elements.newCollectionBtn.click();
    closeNotionStyleMenu(); // Close menu after action
});




// --- Click handler for the whole menu needs to be updated for view-switcher ---
// REPLACE your current notionMenu 'click' listener with this one
// REPLACE your current notionMenu 'click' listener with this one
notionMenu.addEventListener('click', (e) => {
    // Find the closest element that has a data-action attribute
    const target = e.target.closest('[data-action]');
    if (!target) return;

    e.preventDefault();
    const action = target.dataset.action;
    
    // --- Priority 1: Handle the 'Add Note' action ---
    if (action === 'add-note-here') {
        const parentId = target.dataset.parentId === 'null' ? null : target.dataset.parentId;
        const newNote = createNewNote(false, '', parentId); // Create the note but don't switch view
        renderNotionStyleMenu(); // Re-render the menu to show the new note
        showToast(`Note "${newNote.name}" created!`, 'success');
        return; // Stop processing further actions
    }

    // --- Priority 2: Handle all other actions like navigation or expanding a folder ---
    const listItem = target.closest('.collection-item-wrapper, .recent-note-card');
    if (!listItem) return;

    const id = listItem.dataset.id;
    const { item } = findItem(id);
    if (!item) return;

    switch (action) {
        case 'mobile-new-from-template':
    openTemplateModal();
    break;
        case 'mobile-save-as-template':
    saveAsTemplate(note);
    break;
        case 'toggle-expand':
            if (item.type === 'folder') {
                item.expanded = !item.expanded;
                renderNotionStyleMenu(); // Only re-render the menu
            }
            break;
        case 'navigate-folder':
            state.settings.activeCollectionId = item.id;
            state.settings.activeNoteId = null;
            state.settings.activeTag = null;
            closeNotionStyleMenu(); // Close menu and render main app
            render();
            break;
        case 'navigate-note':
            state.settings.activeNoteId = item.id;
            const result = findItem(item.id);
            state.settings.activeCollectionId = (Array.isArray(result.parent)) ? null : result.parent.id;
            state.settings.activeTag = null;
            closeNotionStyleMenu(); // Close menu and render main app
            render();
            break;
    }
    
    saveState();
});

// Add a global click listener to close the profile dropdown when clicking away
document.addEventListener('click', (e) => {
    if (!profileActivator.contains(e.target) && !profileDropdown.classList.contains('hidden')) {
        profileDropdown.classList.add('hidden');
    }
});
// 1. DELINK the old function and LINK the new one to the main menu button.
app.elements.mobileMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openNotionStyleMenu(); // This now opens our new menu
});

// 2. Listener for the new close button.
notionMenuCloseBtn.addEventListener('click', closeNotionStyleMenu);

// 3. Listener to handle clicks inside the new menu (for navigation).
// REPLACE your current notionMenu 'click' listener with this one

// (The original toggleMobileSidebar and its overlay listener are no longer needed and have been removed)

// =================================================================
// END: REPLACEMENT JAVASCRIPT
// =================================================================
                
                app.elements.mobileMenuBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleMobileSidebar(true);
                });
                
                app.elements.mobileSidebarOverlay.addEventListener('click', () => toggleMobileSidebar(false));
                // --- START: New Mobile Menu Logic ---
const mobileMenu = document.getElementById('mobile-menu-fullscreen');
const mobileMenuContent = document.getElementById('mobile-menu-fullscreen-content');
const mobileMenuCloseBtn = document.getElementById('mobile-menu-fullscreen-close-btn');

const openMobileMenu = () => {
    // 1. Get the content from the original (now hidden) dropdown
    const originalContent = app.containers.mobileControlsDropdown.innerHTML;
    
    // 2. Populate the new fullscreen menu with that content
    mobileMenuContent.innerHTML = originalContent;
    
    // 3. Open the fullscreen menu with animation
    mobileMenu.classList.add('open');
    
    // 4. Hide the mobile toolbar
    document.getElementById('mobile-sticky-toolbar')?.classList.add('hidden');

    feather.replace(); // Ensure icons are rendered
};

const closeMobileMenu = () => {
    mobileMenu.classList.remove('open');
    
    // Show the mobile toolbar again ONLY if a note is active
    if (state.settings.activeNoteId) {
        document.getElementById('mobile-sticky-toolbar')?.classList.remove('hidden');
    }
};

// Open menu when the "more" button is clicked
app.elements.mobileMoreButton.addEventListener('click', (e) => {
    e.stopPropagation();
    openMobileMenu();
});

// Close menu with the 'X' button
mobileMenuCloseBtn.addEventListener('click', closeMobileMenu);

// Close menu when an action button inside is clicked
mobileMenuContent.addEventListener('click', (e) => {
    const button = e.target.closest('button');
if (button) {
    // Find the corresponding button in the original dropdown and click it
    const originalButton = app.containers.mobileControlsDropdown.querySelector(`[data-action="${button.dataset.action}"]`);
    if (originalButton) {
        originalButton.click();
    }
    // Also handle view switchers
    const viewButton = app.containers.mobileControlsDropdown.querySelector(`[data-view="${button.dataset.view}"]`);
    if (viewButton) {
        viewButton.click();
    }
    
    closeMobileMenu();
}
});
// --- END: New Mobile Menu Logic ---
                // REPLACE the existing event listener with this one
// REPLACE the existing event listener with this one
app.containers.collectionsList.addEventListener('click', async (e) => {
    // First, check if the new plus button was clicked
    const addBtn = e.target.closest('.add-note-btn');
    if (addBtn) {
        e.preventDefault();
        e.stopPropagation(); // This stops the click from also navigating to the note/folder

        const parentId = addBtn.dataset.parentId === 'null' ? null : addBtn.dataset.parentId;
        createNewNote(true, '', parentId); 
        return; // Action is done, so we stop here
    }

    // If the plus button wasn't clicked, run the original navigation logic
    const itemLink = e.target.closest('.collection-item-link');
    if (!itemLink) return;

    e.preventDefault();

    const wrapper = itemLink.closest('.collection-item-wrapper');
    const id = wrapper.dataset.id;
    const { item } = findItem(id);

    state.settings.activeTag = null; // Deactivate tag filter

    if (item.type === 'folder') {
        if (window.innerWidth < 768) {
            state.settings.activeView = 'list';
        }
        state.settings.activeCollectionId = id;
        state.settings.activeNoteId = null;
        item.expanded = !item.expanded;
    } else if (item.type === 'note') {
        // ---💾 THIS IS THE FIX ---
        // It now works because the function is async
        if (isNoteDirty && state.settings.activeNoteId !== id) {
            await performImmediateSave();
        }
        // ---💾 END OF FIX ---

        state.settings.activeNoteId = id;
        const result = findItem(id);
        const parent = result.parent;
        state.settings.activeCollectionId = (Array.isArray(parent)) ? null : parent.id;
        if (window.innerWidth < 768) {
            toggleMobileSidebar(false);
        }
    }
    saveState();
    render();
});
                
                app.containers.tagList.addEventListener('click', e => {
                    e.preventDefault();
                    const tagItem = e.target.closest('.tag-filter-item');
                    if (!tagItem) return;

                    const tagName = tagItem.dataset.tag;
                    if (state.settings.activeTag === tagName) {
                        state.settings.activeTag = null; // Toggle off
                    } else {
                        state.settings.activeTag = tagName;
                    }

                    state.settings.activeNoteId = null;
                    state.settings.activeCollectionId = null;
                    saveState();
                    render();
                });

                let draggedItemId = null;
                app.containers.collectionsList.addEventListener('dragstart', (e) => {
                    const wrapper = e.target.closest('.collection-item-wrapper');
                    if(wrapper) {
                        draggedItemId = wrapper.dataset.id;
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', draggedItemId);
                        setTimeout(() => wrapper.classList.add('opacity-50'), 0);
                    }
                });

                app.containers.collectionsList.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    document.querySelectorAll('.drop-target-folder').forEach(el => el.classList.remove('drop-target-folder'));
                    document.querySelectorAll('.drop-indicator').forEach(el => el.remove());

                    const targetWrapper = e.target.closest('.collection-item-wrapper');
                    if (!targetWrapper || targetWrapper.dataset.id === draggedItemId) return;
                    
                    const { item: targetItem } = findItem(targetWrapper.dataset.id);
                    const indicator = document.createElement('div');
                    indicator.className = 'drop-indicator';

                    if (targetItem.type === 'folder') {
                        targetWrapper.querySelector('.collection-item').classList.add('drop-target-folder');
                    }
                    
                    const rect = targetWrapper.getBoundingClientRect();
                    const isAfter = e.clientY > rect.top + rect.height / 2;
                    targetWrapper.insertAdjacentElement(isAfter ? 'afterend' : 'beforebegin', indicator);
                });
                
                app.containers.collectionsList.addEventListener('dragend', (e) => {
                    document.querySelectorAll('.collection-item-wrapper.opacity-50').forEach(el => el.classList.remove('opacity-50'));
                     document.querySelectorAll('.drop-indicator, .drop-target-folder').forEach(el => {
                        el.classList.remove('drop-target-folder');
                        if (el.classList.contains('drop-indicator')) el.remove();
                    });
                    draggedItemId = null;
                });

                app.containers.collectionsList.addEventListener('drop', (e) => {
                    e.preventDefault();
                    const droppedOnElement = e.target;
                    if (!draggedItemId) return;

                    document.querySelectorAll('.drop-indicator, .drop-target-folder').forEach(el => {
                        el.classList.remove('drop-target-folder');
                        if (el.classList.contains('drop-indicator')) el.remove();
                    });

                    const dragResult = findItem(draggedItemId);
                    if (!dragResult) return;
                    
                    const sourceArray = Array.isArray(dragResult.parent) ? dragResult.parent : dragResult.parent.children;
                    const [draggedItem] = sourceArray.splice(dragResult.index, 1);
                    
                    const dropWrapper = droppedOnElement.closest('.collection-item-wrapper');
                    
                    if (dropWrapper) { 
                        const dropId = dropWrapper.dataset.id;
                        if (dropId === draggedItem.id) { 
                            sourceArray.splice(dragResult.index, 0, draggedItem);
                            return;
                        }
                        
                        const dropResult = findItem(dropId);
                        if (!dropResult) return; 
                        
                        const dropTargetIsFolder = dropResult.item.type === 'folder' && droppedOnElement.closest('.collection-item').classList.contains('drop-target-folder');

                        if (dropTargetIsFolder) {
                            if (!dropResult.item.children) dropResult.item.children = [];
                            dropResult.item.children.unshift(draggedItem);
                            dropResult.item.expanded = true;
                        } else {
                            const targetArray = Array.isArray(dropResult.parent) ? dropResult.parent : dropResult.parent.children;
                            let targetIndex = dropResult.index;
                            
                            const rect = dropWrapper.getBoundingClientRect();
                            const isAfter = e.clientY > rect.top + rect.height / 2;
                            if (isAfter) targetIndex++;

                            targetArray.splice(targetIndex, 0, draggedItem);
                        }
                    } else { 
                        state.collections.push(draggedItem);
                    }
                    
                    if (draggedItem.type === 'note') {
                         const newParentResult = findItem(draggedItem.id);
                         const newParent = newParentResult ? newParentResult.parent : null;
                         const newParentId = newParent && !Array.isArray(newParent) ? newParent.id : null;
                         const newProjectColumns = newParentId ? state.kanbanColumns[newParentId] : null;
                         if (newProjectColumns && newProjectColumns.length > 0) {
                             draggedItem.status = newProjectColumns[0].id;
                         } else {
                             draggedItem.status = null;
                         }
                    }

                    saveState();
                    render();
                });

                app.containers.kanbanBoard.addEventListener('click', async e => {
                    const addBtn = e.target.closest('#add-column-btn');
                    const renameBtn = e.target.closest('.rename-column-btn');
                    const deleteBtn = e.target.closest('.delete-column-btn');

                    const collectionId = state.settings.activeCollectionId;
                    if (!collectionId) return;

                    if (addBtn) {
                        const newName = await showPrompt({ title: 'New Column', message: 'Enter a name for the new column:', placeholder: 'e.g. Done' });
                        if (newName) {
                            if(!state.kanbanColumns[collectionId]) state.kanbanColumns[collectionId] = [];
                            state.kanbanColumns[collectionId].push({ id: generateId('col'), title: newName });
                            saveState();
                            render();
                        }
                    } else if (renameBtn) {
                        const columnEl = renameBtn.closest('.kanban-column');
                        const columnId = columnEl.dataset.columnId;
                        const column = state.kanbanColumns[collectionId].find(c => c.id === columnId);
                        const newName = await showPrompt({ title: 'Rename Column', message: `Enter a new name for "${column.title}":`, initialValue: column.title });
                        if(newName) {
                            column.title = newName;
                            saveState();
                            render();
                        }
                    } else if (deleteBtn) {
                        const columnEl = deleteBtn.closest('.kanban-column');
                        const columnId = columnEl.dataset.columnId;
                        const confirmed = await showConfirm({ title: 'Delete Column', message: 'Are you sure you want to delete this column? Notes inside will be moved to the first column.', confirmText: 'Delete' });
                        if (confirmed) {
                            const columns = state.kanbanColumns[collectionId];
                            const columnIndex = columns.findIndex(c => c.id === columnId);
                            const notesToMove = findItem(collectionId).item.children.filter(n => n.status === columnId);
                            
                            columns.splice(columnIndex, 1);

                            if(columns.length > 0) {
                                notesToMove.forEach(n => n.status = columns[0].id);
                            } else {
                                notesToMove.forEach(n => n.status = null);
                            }

                            saveState();
                            render();
                        }
                    }
                });
                
                let draggedKanbanNoteId = null;
                app.containers.kanbanBoard.addEventListener('dragstart', (e) => {
                    if (e.target.classList.contains('kanban-card')) {
                        draggedKanbanNoteId = e.target.dataset.noteId;
                        e.dataTransfer.setData('text/plain', draggedKanbanNoteId);
                        setTimeout(() => e.target.classList.add('dragging'), 0);
                    }
                });

                app.containers.kanbanBoard.addEventListener('dragend', (e) => {
                    if (e.target.classList.contains('kanban-card')) {
                        e.target.classList.remove('dragging');
                    }
                    document.querySelectorAll('.drop-indicator').forEach(el => el.remove());
                    draggedKanbanNoteId = null;
                });

                app.containers.kanbanBoard.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    const column = e.target.closest('.kanban-column');
                    if (column) {
                        document.querySelectorAll('.drop-indicator').forEach(el => el.remove());

                        const cardsContainer = column.querySelector('.cards-container');
                        const afterElement = [...cardsContainer.querySelectorAll('.kanban-card:not(.dragging)')].reduce((closest, child) => {
                            const box = child.getBoundingClientRect();
                            const offset = e.clientY - box.top - box.height / 2;
                            if (offset < 0 && offset > closest.offset) {
                                return { offset: offset, element: child };
                            } else {
                                return closest;
                            }
                        }, { offset: Number.NEGATIVE_INFINITY }).element;
                        
                        const indicator = document.createElement('div');
                        indicator.className = 'drop-indicator';

                        if (afterElement == null) {
                            cardsContainer.appendChild(indicator);
                        } else {
                            cardsContainer.insertBefore(indicator, afterElement);
                        }
                    }
                });
                
                app.containers.kanbanBoard.addEventListener('drop', (e) => {
                    e.preventDefault();
                    const columnEl = e.target.closest('.kanban-column');
                    if (columnEl && draggedKanbanNoteId) {
                        const newColumnId = columnEl.dataset.columnId;
                        const collectionId = state.settings.activeCollectionId;
                        const collectionResult = findItem(collectionId);
                        const collectionNotes = collectionResult.item.children;

                        const dragResult = findItem(draggedKanbanNoteId);
                        const [draggedNote] = collectionNotes.splice(collectionNotes.indexOf(dragResult.item), 1);
                        draggedNote.status = newColumnId;
                        
                        const dropIndicator = columnEl.querySelector('.drop-indicator');
                        if (dropIndicator) {
                            const nextCard = dropIndicator.nextElementSibling;
                            if (nextCard) {
                                const nextNoteId = nextCard.dataset.noteId;
                                const nextNote = findItem(nextNoteId).item;
                                const targetIndex = collectionNotes.indexOf(nextNote);
                                collectionNotes.splice(targetIndex, 0, draggedNote);
                            } else {
                                collectionNotes.push(draggedNote);
                            }
                            dropIndicator.remove();
                        } else {
                            collectionNotes.push(draggedNote);
                        }
                        
                        saveState();
                        renderKanbanView();
                        feather.replace();
                    }
                });
                
                app.elements.viewSwitcher.addEventListener('click', (e) => {
                    const button = e.target.closest('.view-btn');
                    if(button && !button.classList.contains('active')) {
                        state.settings.activeView = button.dataset.view;
                        saveState();
                        renderMainView();
                        feather.replace();
                    }
                });

                // Located inside the init() function
app.containers.mobileControlsDropdown.addEventListener('click', async (e) => {
    
    const button = e.target.closest('button');
    if (!button) return;

    const closeDropdown = () => {
        const dropdown = app.containers.mobileControlsDropdown;
        dropdown.classList.add('scale-95', 'opacity-0');
        setTimeout(() => dropdown.classList.add('hidden'), 100);
    };

    const action = button.dataset.action;
    const noteId = state.settings.activeNoteId;
    
    // START: Actions that DON'T need an active note
    // START: Actions that DON'T need an active note
if (action === 'mobile-new-note') {
    closeDropdown();
    createNewNote(true, {}); // Pass empty object for a blank note
    return;
}
if (action === 'mobile-new-from-template') {
    closeDropdown();
    openTemplateModal();
    return;
}
    if (action === 'mobile-delete-folder') {
        closeDropdown();
        const collectionId = state.settings.activeCollectionId;
        if (!collectionId) return;

        const { item: folder, parent, index } = findItem(collectionId);
        if (!folder) return;

        const parentArray = Array.isArray(parent) ? parent : parent.children;

        const confirmed = await showConfirm({
            title: `Delete Folder "${folder.name}"`,
            message: 'This will delete the folder and <strong>all notes inside it</strong>. This action cannot be undone.',
            confirmText: 'Delete'
        });

        if (confirmed) {
            parentArray.splice(index, 1);
            showToast(`Folder "${folder.name}" deleted.`, 'success');
            state.settings.activeCollectionId = null;
            state.settings.activeNoteId = null;
            saveState();
            buildLunrIndex();
            render();
        }
        return;
    }
    if (action === 'mobile-rename-folder') {
        closeDropdown();
        const collectionId = state.settings.activeCollectionId;
        if (!collectionId) return;

        const { item: folder } = findItem(collectionId);
        if (!folder) return;

        const newName = await showPrompt({
            title: 'Rename Folder',
            message: `Enter a new name for "${folder.name}":`,
            initialValue: folder.name
        });

        if (newName && newName !== folder.name) {
            folder.name = newName;
            saveState();
            buildLunrIndex();
            render();
            showToast(`Folder renamed to "${newName}"`, 'success');
        }
        return;
    }
    // END: Actions that DON'T need an active note


    // Handle all actions that require an active note
    // Handle all actions that require an active note
    if (action && noteId) {
        closeDropdown(); // Close menu immediately after an action is clicked
        
        // --- FIX STARTS HERE ---
        // Get the full note object from the cache instead of the sidebar stub.
        const noteData = window.noteCache[noteId];
        const note = noteData ? { id: noteId, ...noteData } : null; 
        if (!note) return;
        
        const { parent, index } = findItem(noteId);
        // --- FIX ENDS HERE ---

        if (!parent) return; // Added a safety check for the parent object

        const parentArray = Array.isArray(parent) ? parent : parent.children;
        const plainContent = (note.content || '').replace(/<[^>]*>?/gm, '').trim();

        switch (action) {
            case 'mobile-summarize':
                handleSummarize(plainContent);
                break;
            case 'mobile-quiz':
                handleGenerateQuiz(plainContent, note);
                break;
            case 'mobile-flashcard':
                handleFlashcardMode(note);
                break;
            case 'mobile-save-as-template': // ADDED THIS CASE
                saveAsTemplate(note);
                break;
            case 'mobile-rename':
                const newName = await showPrompt({ title: 'Rename', message: `Enter a new name for "${note.name}":`, initialValue: note.name });
                if (newName) {
                    note.name = newName;
                    saveState();
                    buildLunrIndex();
                    render();
                }
                break;
            case 'mobile-duplicate':
                const newItem = duplicateItem(note);
                parentArray.splice(index + 1, 0, newItem);
                showToast(`Duplicated "${note.name}"`);
                saveState();
                buildLunrIndex();
                render();
                break;
            case 'mobile-pin':
                note.pinned = !note.pinned;
                showToast(note.pinned ? `Pinned "${note.name}"` : `Unpinned "${note.name}"`);
                saveState();
                render();
                break;
            case 'mobile-delete':
                const confirmed = await showConfirm({ title: `Delete "${note.name}"`, message: 'This action cannot be undone.', confirmText: 'Delete' });
                if (confirmed) {
                    parentArray.splice(index, 1);
                    showToast(`"${note.name}" deleted.`);
                    state.settings.activeNoteId = null;
                    saveState();
                    buildLunrIndex();
                    render();
                }
                break;
            case 'mobile-history':
                openVersionHistoryModal();
                break;
            case 'mobile-checkpoint':
    const message = await showPrompt({
        title: 'Save Checkpoint',
        message: 'Add a short message to describe this version:',
        placeholder: 'e.g., Final draft before review'
    });
    if (message) {
        performImmediateSave(); // Ensure latest content is captured
        // FIX: Get the full note data from the global cache, which includes the content.
        const currentNote = window.noteCache[noteId];
        if (currentNote) {
            // FIX: Pass the correct properties to the save function.
            saveNoteVersion(noteId, currentNote.content, message);
            saveState();
            showToast('✅ Checkpoint saved!', 'success');
        }
    }
    break;
            case 'mobile-share':
                handleShareNote();
                break;
            case 'mobile-upload':
                document.getElementById('file-upload-input').click();
                break;
            case 'mobile-collaborate':
                openShareModal();
                break;
            case 'mobile-add-checklist':
                restoreSelectionAndExec(() => {
                    const newDefaultChecklistHTML = `
<div class="checklist-container" contenteditable="false">
    <div class="checklist-header">
        <h4 class="checklist-title font-semibold text-text-primary flex-grow">Untitled Checklist</h4>
        <button class="checklist-header-btn" data-action="edit" title="Edit Checklist"><i data-feather="edit" class="w-4 h-4"></i></button>
        <button class="checklist-header-btn delete" data-action="delete" title="Delete Checklist"><i data-feather="trash-2" class="w-4 h-4"></i></button>
    </div>
    <div class="checklist-progress-container">
        <div class="checklist-progress-bar">
            <div class="checklist-progress-fill" style="width: 0%;"></div>
        </div>
        <span class="checklist-progress-text">0% Complete</span>
    </div>
    <ul class="checklist-body">
        <li class="checklist-item" data-checked="false"><input type="checkbox" class="checklist-item-checkbox" onclick="return false;"><span class="checklist-item-text" contenteditable="false">New item</span></li>
    </ul>
</div>
<p><br></p>
`;
                    document.execCommand('insertHTML', false, newDefaultChecklistHTML);
                    feather.replace();
                });
                break;
        }
    } 
    // Handle view switching, which doesn't need an active note
    else if (button.classList.contains('view-btn-mobile')) {
        state.settings.activeView = button.dataset.view;
        saveState();
        renderMainView();
        renderMobileControls();
    }
});
                
                app.containers.mainContentArea.addEventListener('click', async (e) => {
                    const deleteTableBtn = e.target.closest('.delete-table-btn');

if (deleteTableBtn) {

    e.preventDefault();

    const table = deleteTableBtn.closest('table');

    if (table) {

        const confirmed = await showConfirm({

            title: 'Delete Table',

            message: 'Are you sure you want to permanently delete this table and all its content?',

            confirmText: 'Delete'

        });

        if (confirmed) {

            table.remove();

            performImmediateSave();

            showToast('Table deleted.', 'info');

        }

    }

    return; // Stop further actions

}
    const exitBtn = e.target.closest('.exit-code-btn');
    if (exitBtn) {
        const wrapper = exitBtn.closest('.code-block-wrapper');
        if (wrapper) {
            const newP = document.createElement('p');
            newP.innerHTML = '<br>';
            wrapper.after(newP);

            const selection = window.getSelection();
            const range = document.createRange();
            range.setStart(newP, 0);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);

            saveNoteContent();
        }
        return;
    }
    const backlink = e.target.closest('.backlink-item');
    if (backlink) {
        e.preventDefault();
        state.settings.activeNoteId = backlink.dataset.noteId;
        saveState();
        render();
        if (window.innerWidth < 768) {
            toggleMobileSidebar(false);
        }
        return;
    }

    const deleteBlockBtn = e.target.closest('.delete-block-btn');
    if (deleteBlockBtn) {
        const wrapper = deleteBlockBtn.closest('.code-block-wrapper');
        if (wrapper) {
            const parentEditor = wrapper.parentNode;
            const wasLastElement = (wrapper.nextElementSibling === null);

            const nextEl = wrapper.nextElementSibling;
            if (nextEl && nextEl.tagName === 'P' && (nextEl.innerHTML === '<br>' || nextEl.innerHTML === '')) {
                nextEl.remove();
            }

            wrapper.remove();

            if (wasLastElement) {
                const newP = document.createElement('p');
                newP.innerHTML = '<br>';
                parentEditor.appendChild(newP);
                const selection = window.getSelection();
                const range = document.createRange();
                range.setStart(newP, 0);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
            }

            saveNoteContent();
            showToast('Code block deleted', 'info');
        }
        return;
    }

    // --- FIX STARTS HERE FOR SUMMARIZE/QUIZ BUTTONS ---
    // --- FIX STARTS HERE FOR SUMMARIZE/QUIZ BUTTONS ---
    const summarizeBtn = e.target.closest('.summarize-btn');
    if (summarizeBtn) {
        e.preventDefault();
        e.stopPropagation();
        const noteId = summarizeBtn.dataset.noteId;
        const noteData = window.noteCache[noteId]; // Get full data from cache
        const plainContent = (noteData?.content || '').replace(/<[^>]*>?/gm, '').trim();
        if (!plainContent) {
            showToast("Note is empty, nothing to summarize.", "info");
            return;
        }
        handleSummarize(plainContent);
        return;
    }
    const quizBtn = e.target.closest('.quiz-btn');
    if (quizBtn) {
        e.preventDefault();
        e.stopPropagation();
        const noteId = quizBtn.dataset.noteId;
        const noteData = window.noteCache[noteId]; // Get full data from cache
        const note = noteData ? { id: noteId, ...noteData } : null; // Reconstruct note object for the handler
        const plainContent = (noteData?.content || '').replace(/<[^>]*>?/gm, '').trim();
        if (!plainContent) {
            showToast("Note is empty, cannot generate a quiz.", "info");
            return;
        }
        handleGenerateQuiz(plainContent, note);
        return;
    }
    // --- FIX ENDS HERE ---
    // --- FIX ENDS HERE ---

    const copyBtn = e.target.closest('.copy-code-btn');
    if (copyBtn) {
         const codeBlock = copyBtn.closest('.code-block-wrapper, .hljs').querySelector('pre, code');
         if(codeBlock) {
            const code = codeBlock.innerText;
            navigator.clipboard.writeText(code)
                .then(() => showToast('Code copied!', 'success'))
                .catch(err => showToast('Failed to copy code', 'error'));
         }
        return;
    }

    const card = e.target.closest('.kanban-card, .list-note-item, .search-result-item');
    if (card) {
        if (isSearchActive && card.classList.contains('search-result-item')) {
            state.settings.searchHighlightQuery = app.search.input.value;
            closeSearch(true);
        }
        state.settings.activeNoteId = card.dataset.noteId;
        const { parent } = findItem(state.settings.activeNoteId);
        state.settings.activeCollectionId = (Array.isArray(parent)) ? null : parent.id;
        state.settings.activeTag = null;
        saveState();
        render();
        return;
    }

    const internalLink = e.target.closest('a.internal-link');
    if (internalLink) {
        e.preventDefault();
        const noteId = internalLink.dataset.noteId;
        if(noteId) {
            state.settings.activeNoteId = noteId;
            const { parent } = findItem(noteId);
            state.settings.activeCollectionId = (Array.isArray(parent)) ? null : parent.id;
            state.settings.activeTag = null;
            saveState();
            render();
            showToast(`Mapsd to "${internalLink.textContent}"`);
            if (window.innerWidth < 768) {
                toggleMobileSidebar(false);
            }
        }
        return;
    }

    const link = e.target.closest('a');
    if (link && link.href && (app.elements.noteEditorBody.contains(link) || app.elements.markdownPreview.contains(link))) {
        e.preventDefault();
        window.open(link.href, '_blank');
    }
});
                // This is the core save logic
                // This listener handles checklist state changes reliably
app.elements.noteEditorBody.addEventListener('change', (e) => {
    if (e.target.matches('.task-list-item input[type="checkbox"]')) {
        const item = e.target.closest('.task-list-item');
        if (item) {
            item.classList.toggle('checked', e.target.checked);
            if (e.target.checked) {
                e.target.setAttribute('checked', 'true');
            } else {
                e.target.removeAttribute('checked');
            }
            saveNoteContent();
        }
    }
});
// ADD THIS ENTIRE NEW FUNCTION
/**
 * Saves a specific note's data directly to Firestore.
 * This is used by AI agents for background operations.
 */
const saveSpecificNoteToFirestore = async (noteId, noteData) => {
    const user = window.auth.currentUser;
    if (!user) throw new Error("User not authenticated.");

    try {
        if (user.uid === noteData.ownerId) {
            const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
            const noteRef = doc(db, "notes", noteId);
            await updateDoc(noteRef, noteData);
        } else {
            // This handles cases where an agent edits a note shared with them
            const { httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
            const updateNote = httpsCallable(window.functions, 'updateNoteAsCollaborator');
            await updateNote({
                noteId: noteId,
                newName: noteData.name,
                newContent: noteData.content,
                newExcerpt: noteData.excerpt,
                newLinks: noteData.links,
                newTags: noteData.tags,
                modifiedAt: noteData.modifiedAt
            });
        }
        return true;
    } catch (error) {
        console.error(`Failed to save note ${noteId} specifically:`, error);
        throw new Error(`Database error while saving note ${noteId}.`);
    }
};
// =================================================================
// START: REPLACEMENT saveNoteContent FUNCTION (FOR COLLABORATION)
// =================================================================
// notetakeapp.html

// =================================================================
// START: REPLACEMENT performImmediateSave FUNCTION
// =================================================================
performImmediateSave = async () => {
    const noteId = state.settings.activeNoteId;
    if (!noteId || !isNoteDirty) return; // Only save if there are changes

    const user = window.auth.currentUser;
    if (!user) return;

    const noteStub = findItem(noteId)?.item;
    const noteContent = window.noteCache[noteId];
    if (!noteStub || !noteContent) return;

    // --- Prepare the data to be saved ---
    const newName = app.elements.noteEditorTitle.value;
    const newContent = app.elements.noteEditorBody.innerHTML;
    const plainText = newContent.replace(/<[^>]*>?/gm, ' ').trim();
    const excerpt = plainText.substring(0, 200);
    const nameChanged = noteStub.name !== newName;

    // Update the local cache first
    noteContent.name = newName;
    noteContent.content = newContent;
    noteContent.excerpt = excerpt;
    noteContent.modifiedAt = new Date().toISOString();
    updateNoteLinks(noteContent);
    updateNoteTags(noteContent);

    // Sync changes to the sidebar data
    noteStub.name = newName;
    noteStub.excerpt = excerpt;
    noteStub.tags = noteContent.tags;

    try {
        // --- THIS IS THE KEY CHANGE ---
        // We now call the dedicated function to save ONLY the note content.
        await saveSpecificNoteToFirestore(noteId, noteContent);

        activeNoteCleanCopy = newContent;
        isNoteDirty = false;
        updateSaveIndicator();
        scheduleRebuildIndex();
        renderTagList();
        
        // If the name changed, we also need to save the main state file (which holds the hierarchy)
        if (nameChanged) {
            await saveState(); 
            renderCollectionsList();
        }
    } catch (error) {
        console.error("Failed to save note:", error);
        showToast("Error saving note. " + (error.message || ''), 'error');
    }
};
// =================================================================
// END: REPLACEMENT performImmediateSave FUNCTION
// =================================================================
// Find Here If Broken
// This re-introduces the debounced function that was missing
saveNoteContent = debounce(performImmediateSave, 5000);
// =================================================================
// END: REPLACEMENT saveNoteContent FUNCTION
// =================================================================
// This is the single, correct 'input' listener for the note editor
app.elements.noteEditorBody.addEventListener('input', (e) => { // Added 'e' event parameter
    if (!isNoteDirty) {
        isNoteDirty = true;
        updateSaveIndicator();
    }

    // NEW: Check if the user typed a space or a closing character to trigger formatting
    if ([' ', '*', '_', '~', '`'].includes(e.data)) {
        handleMarkdownFormatting();
    }

    // Trigger the debounced functions for saving and updating stats
    saveNoteContent();
    updateStatsDebounced();
});
                app.elements.noteEditorBody.addEventListener('input', () => {
                    saveNoteContent();
                    updateStatsDebounced();
                });

                // REPLACE your entire existing 'noteEditorBody' keydown listener with this one
// REPLACE THE ENTIRE 'keydown' LISTENER FOR THE EDITOR BODY
app.elements.noteEditorBody.addEventListener('keydown', (e) => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const node = range.startContainer.nodeType === 3 ? range.startContainer.parentNode : range.startContainer;

    // --- START: NEW, SIMPLIFIED & RELIABLE LIST LOGIC ---

    // 1. Automatic List Creation on Spacebar
    if (e.key === ' ') {
        const block = node.closest('p, div');
        if (block && block.textContent === '-') {
            e.preventDefault();
            document.execCommand('insertUnorderedList');
            // The command leaves the "-" behind, so we find the new list item and clear it.
            const li = window.getSelection().anchorNode.parentNode.closest('li');
            if (li) li.innerHTML = '<br>';
            return;
        }
        if (block && /^\d+\.$/.test(block.textContent)) {
            e.preventDefault();
            document.execCommand('insertOrderedList');
            const li = window.getSelection().anchorNode.parentNode.closest('li');
            if (li) li.innerHTML = '<br>';
            return;
        }
    }

    // 2. Exit List on Double-Enter
    if (e.key === 'Enter' && !e.shiftKey) {
        const li = node.closest('li');
        if (li && li.textContent.trim() === '') {
            e.preventDefault();
            document.execCommand('outdent');
            return;
        }
    }

    // 3. Convert List back to Paragraph on Backspace at the start
    if (e.key === 'Backspace' && range.startOffset === 0 && selection.isCollapsed) {
        const li = node.closest('li');
        if (li) {
            e.preventDefault();
            document.execCommand('outdent');
            return;
        }
    }
    // --- END: NEW, SIMPLIFIED & RELIABLE LIST LOGIC ---

    // --- START: GENERALIZED BLOCK ESCAPE LOGIC (Working as intended) ---
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        let elementToEscape = node.closest('.code-block-wrapper, blockquote, table, .task-list-item');
        if (!elementToEscape) {
            const inlineCode = node.closest('code:not(pre code)');
            if (inlineCode) elementToEscape = inlineCode.closest('p, div, li');
        }
        if (elementToEscape) {
            e.preventDefault();
            const newP = document.createElement('p');
            newP.innerHTML = '<br>';
            elementToEscape.after(newP);
            const newRange = document.createRange();
            newRange.setStart(newP, 0);
            selection.removeAllRanges();
            selection.addRange(newRange);
            saveNoteContent();
            return;
        }
    }
    // --- END: GENERALIZED BLOCK ESCAPE LOGIC ---

    // --- START: EXISTING BLOCKQUOTE & CODE BLOCK LOGIC (Working as intended) ---
    if (e.key === 'Enter' && !e.shiftKey) {
        const currentBlock = node.closest('p, div');
        if (currentBlock) {
            const blockquote = currentBlock.closest('blockquote');
            if (blockquote && currentBlock.textContent.trim() === '' && (currentBlock.innerHTML === '' || currentBlock.innerHTML === '<br>')) {
                e.preventDefault();
                const newP = document.createElement('p');
                newP.innerHTML = '<br>';
                blockquote.after(newP);
                currentBlock.remove();
                if (blockquote.textContent.trim() === '') blockquote.remove();
                const newRange = document.createRange();
                newRange.setStart(newP, 0);
                selection.removeAllRanges();
                selection.addRange(newRange);
                saveNoteContent();
                return;
            }
        }
    }
    if (e.key === 'Backspace' && selection.isCollapsed && range.startOffset === 0) {
        const pre = node.closest('pre');
        if (pre && pre.textContent.length === 0) {
            const wrapper = pre.closest('.code-block-wrapper');
            if (wrapper) {
                e.preventDefault();
                wrapper.remove();
                saveNoteContent();
                return;
            }
        }
    }
    if (e.key === 'ArrowDown') {
        const pre = node.closest('pre');
        if (pre) {
            const codeEl = pre.querySelector('code');
            if (codeEl && selection.isCollapsed) {
                const textContent = codeEl.textContent || '';
                if (range.startOffset === textContent.length) {
                    const wrapper = pre.closest('.code-block-wrapper');
                    if (wrapper && !wrapper.nextElementSibling) {
                        e.preventDefault();
                        const newP = document.createElement('p');
                        newP.innerHTML = '<br>';
                        wrapper.after(newP);
                        const newRange = document.createRange();
                        newRange.setStart(newP, 0);
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                    }
                }
            }
        }
    }
    // --- END: EXISTING BLOCKQUOTE & CODE BLOCK LOGIC ---
});

                // NEW: Enhanced paste event listener
// REPLACE THE OLD 'paste' LISTENER WITH THIS UPGRADED VERSION
app.elements.noteEditorBody.addEventListener('paste', (e) => {
    // Check for image files first (existing logic)
    const files = e.clipboardData.files;
    let handledFile = false;
    for (const file of files) {
        if (file.type.startsWith('image/')) {
            handleFileUpload(file);
            e.preventDefault();
            handledFile = true;
        }
    }
    if (handledFile) return;

    e.preventDefault();
    let pastedHtml = e.clipboardData.getData('text/html');
    const plainText = e.clipboardData.getData('text/plain');

    // --- START: NEW SPREADSHEET PASTE LOGIC ---
    // Check if the plain text is tab-separated and has multiple lines, which is typical for spreadsheets.
    if (plainText.includes('\t') && plainText.includes('\n')) {
        const lines = plainText.trim().split('\n').map(line => line.split('\t'));
        const cols = lines[0].length;

        // Ensure it's a consistent table structure
        if (lines.every(line => line.length === cols)) {
            let tableHTML = '<table style="width:100%"><thead>';
            tableHTML += `<tr><th colspan="${cols}" contenteditable="false"><div class="table-header-controls"><div class="table-filter-wrapper"><i data-feather="search" class="filter-icon"></i><input class="table-filter-input" placeholder="Filter table..."/></div><button class="toggle-filter-btn" title="Toggle Filter"><i data-feather="chevrons-up" class="w-4 h-4"></i></button></div></th></tr>`;
            
            const [headers, ...rows] = lines;
            tableHTML += '<tr>';
            headers.forEach(header => tableHTML += `<th class="sortable-header" data-sort-dir="none" contenteditable="true">${header}</th>`);
            tableHTML += '</tr></thead><tbody>';

            rows.forEach(row => {
                tableHTML += '<tr>';
                row.forEach(cell => tableHTML += `<td contenteditable="true">${cell}</td>`);
                tableHTML += '</tr>';
            });
            tableHTML += '</tbody></table><p><br></p>';
            
            restoreSelectionAndExec(() => document.execCommand('insertHTML', false, tableHTML));
            feather.replace();
            saveNoteContent();
            return; // Exit after handling the spreadsheet paste
        }
    }
    // --- END: NEW SPREADSHEET PASTE LOGIC ---

    // Fallback to existing logic for other HTML or plain text pastes
    if (!pastedHtml) {
        pastedHtml = `<p>${plainText.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, '</p><p>')}</p>`;
    }

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = pastedHtml;
    tempDiv.querySelectorAll('*').forEach(el => {
        el.removeAttribute('style');
        el.removeAttribute('class');
        if (el.tagName.toLowerCase() === 'font') {
            const parent = el.parentNode;
            while (el.firstChild) parent.insertBefore(el.firstChild, el);
            parent.removeChild(el);
        }
    });
    const sanitizedHtml = tempDiv.innerHTML;
    const finalHtml = upgradePastedTables(sanitizedHtml);

    document.execCommand('insertHTML', false, finalHtml);
    feather.replace();
    saveNoteContent();
});

                app.elements.noteEditorBody.addEventListener('drop', (e) => {
                    e.preventDefault();
                    const files = e.dataTransfer.files;
                    for (const file of files) {
                        handleImageFile(file);
                    }
                });
                
                app.elements.noteEditorBody.addEventListener('dragover', (e) => {
                    e.preventDefault();
                });
                
                app.toolbar.ocrBtn.addEventListener('click', () => app.toolbar.ocrFileInput.click());
                app.toolbar.ocrFileInput.addEventListener('change', async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    if (!state.settings.activeNoteId) {
                        createNewNote();
                    }
                    
                    const toastId = showToast('Recognizing text...', 'loading');
                    try {
                        const { data: { text } } = await Tesseract.recognize(file, 'eng');
                        const formattedText = `<p>${text.replace(/\n/g, '</p><p>')}</p>`;
                        app.elements.noteEditorBody.focus();
                        document.execCommand('insertHTML', false, formattedText);
                        saveNoteContent();
                        showToast('Text inserted!', 'success');
                    } catch (err) {
                        console.error(err);
                        showToast('Could not recognize text.', 'error');
                    } finally {
                        dismissToast(toastId);
                        app.toolbar.ocrFileInput.value = '';
                    }
                });
                
                app.toolbar.dictateBtn.addEventListener('click', () => {
                    if (!speechRecognizer) return;
                    if (isDictating) {
                        speechRecognizer.stop();
                        isDictating = false;
                        app.toolbar.dictateBtn.classList.remove('recording');
                        showToast('Dictation stopped.', 'info');
                    } else {
                        speechRecognizer.start();
                        isDictating = true;
                        app.toolbar.dictateBtn.classList.add('recording');
                        showToast('Listening...', 'info');
                    }
                });

                app.toolbar.graphBtn.addEventListener('click', () => {
    const noteId = state.settings.activeNoteId;
    if (!noteId) return;
    document.getElementById('sidebar-toggle-btn').style.display = 'none';

    try {
        // --- FIX START: Use full note data from the cache ---
        const allNotes = Object.entries(window.noteCache).map(([id, data]) => ({ id, ...data }));
        const currentNote = window.noteCache[noteId];

        if (!currentNote) {
            return showToast('❌ Note content not loaded. Use /load or open the note first.', 'error');
        }
        // --- FIX END ---

        const nodes = new vis.DataSet([{ id: noteId, label: currentNote.name, color: getComputedStyle(document.documentElement).getPropertyValue('--accent-primary') }]);
        const edges = new vis.DataSet();

        // Links from current note
        (currentNote.links || []).forEach(linkName => {
            const targetNote = allNotes.find(n => n.name.toLowerCase() === linkName.toLowerCase());
            if (targetNote && targetNote.id !== noteId) {
                if (!nodes.get(targetNote.id)) {
                    nodes.add({ id: targetNote.id, label: targetNote.name });
                }
                edges.add({ from: noteId, to: targetNote.id, arrows: 'to' });
            }
        });

        // Links to current note (backlinks)
        allNotes.forEach(note => {
            if (note.id !== noteId && (note.links || []).some(link => link.toLowerCase() === currentNote.name.toLowerCase())) {
                 if (!nodes.get(note.id)) {
                    nodes.add({ id: note.id, label: note.name });
                }
                edges.add({ from: note.id, to: noteId, arrows: 'to' });
            }
        });
        
        const computedStyles = getComputedStyle(document.documentElement);

        const options = {
            nodes: {
                shape: 'box',
                color: computedStyles.getPropertyValue('--bg-pane-dark').trim(),
                font: { color: computedStyles.getPropertyValue('--text-primary').trim() },
                borderWidth: 1,
            },
            edges: {
                color: {
                    color: computedStyles.getPropertyValue('--text-tertiary').trim(),
                    highlight: computedStyles.getPropertyValue('--accent-primary').trim(),
                }
            },
            physics: {
                enabled: true,
                solver: 'barnesHut',
                barnesHut: {
                    gravitationalConstant: -4000,
                    centralGravity: 0.1,
                    springLength: 150,
                }
            },
            interaction: {
                dragNodes: true,
                dragView: true,
                zoomView: true
            }
        };
        const network = new vis.Network(app.modals.graphContainer, { nodes, edges }, options);

        network.on('click', function(params) {
            if (params.nodes.length > 0) {
                const clickedNoteId = params.nodes[0];
                const noteToOpen = findItem(clickedNoteId)?.item;
                if (noteToOpen) {
                    state.settings.activeNoteId = clickedNoteId;
                    const { parent } = findItem(clickedNoteId);
                    state.settings.activeCollectionId = (Array.isArray(parent)) ? null : parent.id;
                    state.settings.activeTag = null;
                    saveState();
                    render();
                    closeModal(app.modals.graph);
                }
            }
        });

        const createTooltip = () => {
            let tooltip = document.getElementById('note-graph-tooltip');
            if (!tooltip) {
                tooltip = document.createElement('div');
                tooltip.id = 'note-graph-tooltip';
                tooltip.style.position = 'absolute';
                tooltip.style.visibility = 'hidden';
                tooltip.style.backgroundColor = 'var(--bg-pane-dark)';
                tooltip.style.border = '1px solid var(--border-color)';
                tooltip.style.borderRadius = '8px';
                tooltip.style.padding = '12px';
                tooltip.style.maxWidth = '300px';
                tooltip.style.color = 'var(--text-primary)';
                tooltip.style.boxShadow = '0 4px 12px var(--shadow-color)';
                tooltip.style.pointerEvents = 'none';
                tooltip.style.zIndex = '10000';
                tooltip.style.opacity = '0';
                tooltip.style.transition = 'opacity 0.2s ease-in-out';
                document.body.appendChild(tooltip);
            }
            return tooltip;
        };
        
        network.on('hoverNode', function(params) {
            const hoveredNoteId = params.node;
            // --- FIX: Get excerpt from the full note data in the cache ---
            const noteData = window.noteCache[hoveredNoteId];
            const tooltip = createTooltip();

            if (noteData) {
                const excerpt = noteData.excerpt || 'No content preview...';

                tooltip.innerHTML = `
                    <h4 style="font-weight: 600; margin: 0 0 5px 0;">${noteData.name}</h4>
                    <p style="font-size: 0.875rem; margin: 0; color: var(--text-secondary);">${excerpt}</p>
                `;

                tooltip.style.left = `${params.event.pointer.DOM.x + 15}px`;
                tooltip.style.top = `${params.event.pointer.DOM.y + 15}px`;
                tooltip.style.visibility = 'visible';
                tooltip.style.opacity = '1';
            }
        });

        network.on('blurNode', function(params) {
            const tooltip = document.getElementById('note-graph-tooltip');
            if (tooltip) {
                tooltip.style.opacity = '0';
                tooltip.style.visibility = 'hidden';
            }
        });

        openModal(app.modals.graph);

    } catch(err) {
        console.error("Error creating note graph:", err);
        showToast('Could not create note graph.', 'error');
    }
});
                document.getElementById('header-template-btn').addEventListener('click', () => {
    const note = findItem(state.settings.activeNoteId)?.item;
    if (note) {
        saveAsTemplate(note);
    }
});
document.getElementById('header-collaborate-btn').addEventListener('click', openShareModal);
                
                app.modals.graphCloseBtn.addEventListener('click', () => closeModal(app.modals.graph));
                
                app.modals.aiCancelBtn.addEventListener('click', () => closeModal(app.modals.aiPrompt));
                app.modals.aiGenerateBtn.addEventListener('click', async () => {
                    const prompt = app.modals.aiPromptInput.value.trim();
                    if (!prompt) {
                        app.modals.aiPromptError.textContent = 'Please enter a prompt.';
                        return;
                    }
                    
                    if (!state.settings.activeNoteId) {
                        createNewNote();
                    }
                    
                    app.modals.aiGenerateBtn.disabled = true;
                    app.modals.aiGenerateBtnText.textContent = 'Generating...';

                    const payload = { contents: [{ parts: [{ text: prompt }] }] };
                    const generatedText = await callGeminiAPI(payload, app.modals.aiPromptError);

                    if (generatedText) {
                        app.elements.noteEditorBody.focus();
                        if (editorSelectionRange) {
                            const selection = window.getSelection();
                            selection.removeAllRanges();
                            selection.addRange(editorSelectionRange);
                        }
                        const formattedHtml = marked.parse(generatedText).trim();
                        document.execCommand('insertHTML', false, formattedHtml);
                        saveNoteContent();
                        closeModal(app.modals.aiPrompt);
                        showToast('AI content inserted!', 'success');
                    }
                    
                    app.modals.aiGenerateBtn.disabled = false;
                    app.modals.aiGenerateBtnText.textContent = 'Generate';
                });
                // --- START: Version History Listeners ---
document.getElementById('history-btn').addEventListener('click', openVersionHistoryModal);
document.getElementById('version-history-close-btn').addEventListener('click', closeVersionHistoryModal);

document.getElementById('version-list-container').addEventListener('click', async (e) => {
    const restoreBtn = e.target.closest('.restore-version-btn');
    if (!restoreBtn) return;

    // Get the preview content directly from the item you clicked on
    const versionItem = restoreBtn.closest('.version-item');
    const previewHTML = versionItem.querySelector('.version-preview').innerHTML;

    const noteId = state.settings.activeNoteId;
    const timestamp = restoreBtn.dataset.versionTimestamp;
    const versionToRestore = state.versions?.[noteId]?.find(v => v.savedAt === timestamp);

    if (!versionToRestore) {
        showToast('Could not find that version.', 'error');
        return;
    }

    const confirmed = await showConfirm({
        title: 'Restore Note Version',
        // This new message includes the content preview for clarity
        message: `This will replace the note's content with the version from <strong>${formatRelativeTime(timestamp)}</strong>.<br><br><p class="text-xs text-text-tertiary">Preview:</p><blockquote class="text-sm p-2 bg-bg-pane-dark rounded-md border-l-4 border-border-color max-h-24 overflow-y-auto">${previewHTML}</blockquote>`,
        confirmText: 'Restore',
        // This makes the button use the brand color instead of red
        confirmClass: 'brand-button'
    });

    if (confirmed) {
        const { item: note } = findItem(noteId);
        if (note) {
            note.content = versionToRestore.content;
            app.elements.noteEditorBody.innerHTML = note.content;
            performImmediateSave();
            closeModal(document.getElementById('version-history-modal'));
            showToast('Note restored successfully!', 'success');
        }
    }
});
// --- END: Version History Listeners ---
                

                const handleSummarize = async (noteContent) => {
    const toastId = showToast('Summarizing...', 'loading');
    const prompt = `Summarize the following text into one or more concise paragraphs:\n\n---\n\n${noteContent}`;
    const payload = { contents: [{ parts: [{ text: prompt }] }] };
    const summaryText = await callGeminiAPI(payload);

    dismissToast(toastId);

    if (summaryText) {
        // New logic: Show the summary in the dedicated modal.
        app.modals.summaryContent.innerHTML = marked.parse(summaryText).trim();
        openModal(app.modals.summary);
        feather.replace();
    } else {
         showToast('Could not generate summary.', 'error');
    }
};
                app.modals.summaryCloseBtn.addEventListener('click', () => closeModal(app.modals.summary));
                app.modals.quizCloseBtn.addEventListener('click', () => closeModal(app.modals.quiz));
app.modals.quizDoneBtn.addEventListener('click', () => closeModal(app.modals.quiz));

app.modals.quizContent.addEventListener('change', e => {
    if (e.target.type === 'radio') { // Logic for single-choice questions
        const questionContainer = e.target.closest('.quiz-question-container');
        const selectedAnswer = e.target.value;
        const correctAnswer = JSON.parse(questionContainer.dataset.correctAnswer);
        const feedbackEl = questionContainer.querySelector('.quiz-feedback');

        questionContainer.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.disabled = true;
            radio.parentElement.classList.add('cursor-not-allowed', 'opacity-60');
        });

        if (selectedAnswer === correctAnswer) {
            feedbackEl.textContent = 'Correct!';
            feedbackEl.className = 'quiz-feedback text-sm mt-2 h-5 font-medium text-green-500';
            e.target.parentElement.classList.add('bg-green-500/20', 'border-green-500');
        } else {
            feedbackEl.textContent = `Incorrect. The correct answer is ${correctAnswer}.`;
            feedbackEl.className = 'quiz-feedback text-sm mt-2 h-5 font-medium text-red-500';
            e.target.parentElement.classList.add('bg-red-500/20', 'border-red-500');
            const correctLabel = questionContainer.querySelector(`input[value="${correctAnswer}"]`).parentElement;
            correctLabel.classList.remove('opacity-60');
            correctLabel.classList.add('bg-green-500/20', 'border-green-500');
        }
    }
});

// Add this new click listener right after the 'change' listener above
app.modals.quizContent.addEventListener('click', e => {
    if (e.target.classList.contains('submit-msq-btn')) { // Logic for multi-select questions
        const questionContainer = e.target.closest('.quiz-question-container');
        const correctAnswers = new Set(JSON.parse(questionContainer.dataset.correctAnswer));
        const selectedAnswers = new Set(Array.from(questionContainer.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value));
        const feedbackEl = questionContainer.querySelector('.quiz-feedback');

        // Check for perfect match
        const isCorrect = correctAnswers.size === selectedAnswers.size && [...correctAnswers].every(answer => selectedAnswers.has(answer));

        questionContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.disabled = true;
            const label = cb.parentElement;
            label.classList.add('cursor-not-allowed', 'opacity-60');
            if (correctAnswers.has(cb.value)) {
                label.classList.add('bg-green-500/20', 'border-green-500');
            } else if (selectedAnswers.has(cb.value)) {
                label.classList.add('bg-red-500/20', 'border-red-500');
            }
        });

        if (isCorrect) {
            feedbackEl.textContent = 'Correct!';
            feedbackEl.className = 'quiz-feedback text-sm mt-2 h-5 font-medium text-green-500';
        } else {
            feedbackEl.textContent = `Incorrect. The correct answer(s): ${Array.from(correctAnswers).join(', ')}.`;
            feedbackEl.className = 'quiz-feedback text-sm mt-2 h-5 font-medium text-red-500';
        }
        e.target.style.display = 'none'; // Hide submit button after answering
    }
});

                app.elements.chatbotFab.addEventListener('click', () => {
                    renderChatHistory();
                    openModal(app.modals.chatbot);
                    app.modals.chatbotInput.focus();
                    feather.replace();
                });
                app.modals.chatbotCloseBtn.addEventListener('click', () => closeModal(app.modals.chatbot));
                app.modals.chatbotClearBtn.addEventListener('click', async () => {
                    const confirmed = await showConfirm({
                        title: 'Clear Chat History',
                        message: 'Are you sure you want to delete the entire conversation and remove all context notes?',
                        confirmText: 'Clear',
                        confirmClass: 'bg-red-500'
                    });
                    if (confirmed) {
                        state.chatHistory = [];
                        window.chatbotContextNoteIds = []; // Also clear the context
                        saveState();
                        renderChatHistory();
                        document.getElementById('chatbot-context-pills').innerHTML = ''; // Clear the UI pills
                        showToast('Chat history cleared', 'success');
                    }
                });

                // REPLACE the existing handleChatSubmit function with this one
const handleChatSubmit = async () => {
    const userInput = app.modals.chatbotInput.value.trim();
    if (!userInput) return;

    // This check will now work correctly with the function you added
    if (window.chatbotContextNoteIds.length > 0) {
        if (!(await ensureAllNotesLoaded(window.chatbotContextNoteIds))) return; // Stop if notes fail to load
    }

    app.modals.chatbotError.textContent = '';
    app.modals.chatbotInput.value = '';
    app.modals.chatbotSendBtn.disabled = true;

    state.chatHistory.push({ role: 'user', text: userInput });
    renderChatHistory();

    const thinkingBubble = document.createElement('div');
    thinkingBubble.className = 'chat-bubble thinking w-fit rounded-lg px-3 py-2 self-start model';
    thinkingBubble.innerHTML = '● ● ●';
    app.modals.chatbotHistory.appendChild(thinkingBubble);
    app.modals.chatbotHistory.scrollTop = app.modals.chatbotHistory.scrollHeight;

    let fullPrompt = "You are a helpful AI assistant. Answer the user's question based on the conversation history and any provided note context.\n\n---\n\n";

    // ** START: THIS IS THE NEW LOGIC TO ADD CONTEXT **
    if (window.chatbotContextNoteIds.length > 0) {
        const context = window.chatbotContextNoteIds.map(id => {
            const noteData = window.noteCache[id];
            if (!noteData) return ''; // Should not happen after ensureAllNotesLoaded, but is a safeguard
            const plainContent = (noteData.content || '').replace(/<[^>]*>?/gm, '');
            return `--- Note Context: "${noteData.name}" ---\n${plainContent}`;
        }).join('\n\n');
        fullPrompt += `CONTEXT FROM NOTES:\n${context}\n\n---\n\n`;
    }
    // ** END: NEW LOGIC **

    state.chatHistory.forEach(msg => {
        fullPrompt += `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.text}\n\n`;
    });

    const payload = { contents: [{ parts: [{ text: fullPrompt }] }] };
    const modelResponse = await callGeminiAPI(payload, app.modals.chatbotError);
    
    thinkingBubble.remove();

    if (modelResponse) {
        state.chatHistory.push({ role: 'model', text: modelResponse });
        renderChatHistory();
    }

    saveState();
    app.modals.chatbotSendBtn.disabled = false;
    app.modals.chatbotInput.focus();
};

                app.modals.chatbotSendBtn.addEventListener('click', handleChatSubmit);
                app.modals.chatbotInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleChatSubmit();
                    }
                });

                app.elements.newCollectionBtn.addEventListener('click', async () => {
    const name = await showPrompt({
        title: 'New Project Folder',
        message: 'Enter a name for your new project:',
        placeholder: 'e.g. Project Phoenix'
    });
    if (name) {
        const newCollection = {
            id: generateId('c'),
            name,
            type: 'folder',
            children: [],
            expanded: true
        };
        state.kanbanColumns[newCollection.id] = [{
            id: generateId('col'),
            title: 'To Do'
        }];
        state.collections.unshift(newCollection);

        // This now uses your corrected createNewNote function,
        // which properly handles creating the Firestore document.
        const newNote = await createNewNote(true, {
            name: 'Getting Started'
        }, newCollection.id);

        // The createNewNote function already saves state and re-renders,
        // so we just need to update the active collection and do one final render.
        state.settings.activeCollectionId = newCollection.id;
        state.settings.activeNoteId = newNote.id;
        await saveState();
        render();
        showToast(`Project "${name}" created!`, 'success');
    }
});

                // --- New Note Dropdown Logic ---
const newNoteContainer = document.getElementById('new-note-dropdown-container');
const newNoteDropdown = document.getElementById('new-note-dropdown');
newNoteContainer.addEventListener('click', (e) => {
    const action = e.target.closest('button')?.dataset.action;
    if (action === 'new-blank-note') {
        createNewNote(true, {}); // Pass empty object for a blank note
        newNoteDropdown.classList.add('hidden');
    } else if (action === 'new-from-template') {
        openTemplateModal();
        newNoteDropdown.classList.add('hidden');
    } else {
        // If the main button is clicked, just toggle the dropdown
        newNoteDropdown.classList.toggle('hidden');
        if(!newNoteDropdown.classList.contains('hidden')) feather.replace();
    }
});
document.addEventListener('click', (e) => {
    if (!newNoteContainer.contains(e.target)) {
        newNoteDropdown.classList.add('hidden');
    }
});

                const openSearch = () => {
                    buildLunrIndex(); // Ensure index is fresh before searching
                    const highlightControls = document.getElementById('highlight-controls');
                    if (!highlightControls.classList.contains('hidden')) {
                        const clearSearchBtn = document.getElementById('clear-search-btn');
                        if (clearSearchBtn) clearSearchBtn.click();
                    }
                    
                    if (window.innerWidth < 768) {
                        // On mobile, show the search bar as an absolute overlay within the header
                        app.search.container.classList.remove('hidden');
                        app.search.container.classList.add('absolute', 'top-0', 'left-0', 'w-full', 'h-full', 'bg-bg-main');
                        app.elements.headerMainContent.classList.add('opacity-0', 'pointer-events-none');
                    } else {
                        // Desktop behavior
                        app.elements.headerMainContent.classList.add('opacity-0', 'pointer-events-none');
                        app.search.container.classList.remove('hidden');
                    }

                    isSearchActive = true;
                    app.search.input.focus();
                    renderMainView();
                };

                const closeSearch = (skipRender = false) => {
                     if (window.innerWidth < 768) {
                        // Properly hide the absolute overlay and restore the main header content
                        app.search.container.classList.add('hidden');
                        app.search.container.classList.remove('absolute', 'top-0', 'left-0', 'w-full', 'h-full', 'bg-bg-main');
                        app.elements.headerMainContent.classList.remove('opacity-0', 'pointer-events-none');
                    } else {
                        // Desktop behavior
                        app.elements.headerMainContent.classList.remove('opacity-0', 'pointer-events-none');
                        app.search.container.classList.add('hidden');
                    }

                    app.search.input.value = '';
                    isSearchActive = false;
                    if (!skipRender) render();
                };

                app.search.icon.addEventListener('click', openSearch);
                app.search.mobileIcon.addEventListener('click', openSearch);
                app.search.closeBtn.addEventListener('click', () => closeSearch());
                app.search.input.addEventListener('input', () => {
                    renderSearchResults(app.search.input.value);
                });

                app.toolbar.editorModeToggle.addEventListener('click', () => {
                    if (!state.settings.activeNoteId) return;
                    state.settings.editorMode = state.settings.editorMode === 'editor' ? 'preview' : 'editor';
                    saveState();
                    renderNoteEditor();
                });

                document.addEventListener('selectionchange', () => {
                    if (isExecutingCommand) return; 
                    if (document.activeElement !== app.elements.noteEditorBody) {
                        app.toolbar.inline.style.opacity = '0';
                        app.toolbar.inline.style.pointerEvents = 'none';
                        return;
                    }
                    const selection = window.getSelection();

                    if (selection.isCollapsed) {
                        app.toolbar.inline.style.opacity = '0';
                        app.toolbar.inline.style.pointerEvents = 'none';
                        return;
                    }

                    if (selection.rangeCount > 0) {
                        editorSelectionRange = selection.getRangeAt(0).cloneRange();
                    }

                    const range = selection.getRangeAt(0);
                    const rect = range.getBoundingClientRect();
                    const toolbarRect = app.toolbar.inline.getBoundingClientRect();
                    app.toolbar.inline.style.top = `${window.scrollY + rect.top - toolbarRect.height - 8}px`;
                    app.toolbar.inline.style.left = `${window.scrollX + rect.left + (rect.width / 2) - (toolbarRect.width / 2)}px`;
                    app.toolbar.inline.style.opacity = '1';
                    app.toolbar.inline.style.transform = 'scale(1)';
                    app.toolbar.inline.style.pointerEvents = 'auto';
                });
                    // ADD THIS NEW EVENT LISTENER
document.getElementById('mobile-sticky-toolbar').addEventListener('mousedown', (e) => {
    const button = e.target.closest('button');
    if (!button) return;

    // Prevent the editor from losing focus
    e.preventDefault();

    // Simulate a click on the corresponding button in the original (but hidden) toolbar
    // This is a clean way to avoid duplicating all the command logic.
    const originalToolbar = document.getElementById('inline-toolbar');
    const { command, value } = button.dataset;
let selector;
if (value) {
  // If the button has a value (like H1, H2), find the exact match
  selector = `[data-command="${command}"][data-value="${value}"]`;
} else {
  // If the button has no value (like Bold, Italic), find the one without that attribute
  selector = `[data-command="${command}"]:not([data-value])`;
}
const originalButton = originalToolbar.querySelector(selector);

    if (originalButton) {
        originalButton.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
         
    }
});
                
                app.toolbar.inline.addEventListener('mousedown', async (e) => {
    const button = e.target.closest('button');
    if (!button) return;

    if (button.id === 'toolbar-scroll-left' || button.id === 'toolbar-scroll-right') {
        return;
    }

    e.preventDefault();

    isExecutingCommand = true; // Lock is activated
    try {
        const command = button.dataset.command;
        const value = button.dataset.value;

        if (command === 'monospace') {
                        restoreSelectionAndExec(() => {
                            const selection = window.getSelection();
                            if (!selection.rangeCount) return;
                            let parent = selection.getRangeAt(0).commonAncestorContainer;
                            parent = parent.nodeType === 3 ? parent.parentNode : parent;
                            const codeTag = parent.closest('code:not(pre code)');
                            if (codeTag) {
                                const content = document.createDocumentFragment();
                                while(codeTag.firstChild) { content.appendChild(codeTag.firstChild); }
                                codeTag.parentNode.replaceChild(content, codeTag);
                            } else {
                                const selectedText = selection.toString();
                                if (selectedText) document.execCommand('insertHTML', false, `<code>${selectedText}</code>`);
                            }
                        });
                        return;
                    }
                    else if (command === 'textColor') {
    restoreSelectionAndExec(() => {
        let colorToApply;
        if (value === 'default') {
            // Get the theme's default text color to "remove" the styling
            colorToApply = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim();
        } else {
            // Get the specific color from our map
            colorToApply = colorMap[value];
        }

        if (colorToApply) {
            document.execCommand('foreColor', false, colorToApply);
            // This helper function is crucial for cleaning up the HTML
            cleanupFontTags();
        }
    });
    return;
}
                    if (command === 'toggleCheckboxes') {
                        restoreSelectionAndExec(() => {
                            const selection = window.getSelection();
                            if (!selection.rangeCount) return;
                            const allChecklistItems = app.elements.noteEditorBody.querySelectorAll('.task-list-item');
                            allChecklistItems.forEach(item => {
                                if (selection.containsNode(item, true)) {
                                    item.classList.toggle('checkbox-hidden');
                                }
                            });
                        });
                        return;
                    }
        if (command === 'formatBlock' && value === 'code') {
             restoreSelectionAndExec(() => {
                const selection = window.getSelection();
                const selectedText = selection.toString();
                let lang = 'plaintext';
                if (/<[a-z][\s\S]*>/i.test(selectedText)) lang = 'html';
                else if (/\b(function|const|let|var|import|export)\b/.test(selectedText)) lang = 'javascript';
                else if (/\b(def|import|class|for|while)\b/.test(selectedText)) lang = 'python';
                const escapedCode = selectedText.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                const codeBlockHTML = `<div class="code-block-wrapper" contenteditable="false"><div class="code-block-header"><span>${lang}</span><div class="flex items-center gap-1"><button class="copy-code-btn" title="Copy Code"><i data-feather="copy" class="w-4 h-4"></i><span>Copy</span></button><button class="delete-block-btn" title="Delete Block"><i data-feather="trash-2" class="w-4 h-4"></i></button></div></div><pre contenteditable="true"><code>${escapedCode}</code></pre></div><p><br></p>`;
                document.execCommand('insertHTML', false, codeBlockHTML);
                feather.replace();
            });
            return;
        }
        if (command === 'insertChecklist') {
            restoreSelectionAndExec(() => {
                const newDefaultChecklistHTML = `
                <div class="checklist-container" contenteditable="false">
                    <div class="checklist-header">
                        <h4 class="checklist-title font-semibold text-text-primary flex-grow">Untitled Checklist</h4>
                        <button class="checklist-header-btn" data-action="edit" title="Edit Checklist"><i data-feather="edit" class="w-4 h-4"></i></button>
                        <button class="checklist-header-btn delete" data-action="delete" title="Delete Checklist"><i data-feather="trash-2" class="w-4 h-4"></i></button>
                    </div>
                    <div class="checklist-progress-container">
                        <div class="checklist-progress-bar">
                            <div class="checklist-progress-fill" style="width: 0%;"></div>
                        </div>
                        <span class="checklist-progress-text">0% Complete</span>
                    </div>
                    <ul class="checklist-body">
                        <li class="checklist-item" data-checked="false"><input type="checkbox" class="checklist-item-checkbox" onclick="return false;"><span class="checklist-item-text" contenteditable="false">New item</span></li>
                    </ul>
                </div>
                <p><br></p>
                `;
                document.execCommand('insertHTML', false, newDefaultChecklistHTML);
                feather.replace();
            });
            return;
        }
        // ... (other if statements are above this) ...

        if (command === 'insertTable') {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) editorSelectionRange = selection.getRangeAt(0).cloneRange();
            openModal(document.getElementById('table-creator-modal'));
            return;
        }
        if (command === 'createLink') {
    const selection = window.getSelection();
    const parentEl = selection.anchorNode?.parentNode.closest('a');

    if (parentEl) {
        restoreSelectionAndExec(() => { document.execCommand('unlink'); });
    } else {
        const selectedText = selection.toString().trim();
        const { result, range } = await openLinkModal();

        if (result && range) {
            selection.removeAllRanges();
            selection.addRange(range);

            let linkHTML = '';
            if (result.type === 'internal') {
                linkHTML = `<a href="#" class="internal-link" data-note-id="${result.id}">${selectedText || result.name}</a>`;
            } else { 
                let finalUrl = result.url;
                if (!/^(https?|ftp):\/\//i.test(finalUrl)) finalUrl = 'https://' + finalUrl;
                linkHTML = `<a href="${finalUrl}" target="_blank" rel="noopener noreferrer">${selectedText || finalUrl}</a>`;
            }
            
            document.execCommand('insertHTML', false, linkHTML);
            performImmediateSave();
            render();
        }
    }
} else if (command === 'insertImage') { // CORRECTED TO 'else if'
            const url = await showPrompt({ title: 'Insert Image', message: 'Enter the image URL:', placeholder: 'https://example.com/image.png' });
            if (url) restoreSelectionAndExec(() => document.execCommand('insertHTML', false, `<img src="${url}" alt="Image">`));
        } else if (command === 'formatBlock') {
             restoreSelectionAndExec(() => {
                const selection = window.getSelection();
                let parentEl = selection.getRangeAt(0).commonAncestorContainer;
                parentEl = parentEl.nodeType === 3 ? parentEl.parentNode : parentEl;
                const isAlreadyBlock = parentEl.closest(value) || (value === 'blockquote' && parentEl.closest('blockquote'));
                if (isAlreadyBlock) {
                    document.execCommand('formatBlock', false, 'p');
                } else {
                    document.execCommand(command, false, value);
                }
            });
        } else {
            restoreSelectionAndExec(() => document.execCommand(command, false, null));
        }
    } finally {
        // Lock is released on the next browser frame
        requestAnimationFrame(() => {
            isExecutingCommand = false;
        });
    }
});

                app.containers.collectionsList.addEventListener('contextmenu', e => {
                    const itemWrapper = e.target.closest('.collection-item-wrapper');
                    
                    app.contextMenu.togglePinBtn.style.display = 'none';
                    app.contextMenu.renameBtn.style.display = 'none';
                    app.contextMenu.deleteBtn.style.display = 'none';
                    app.contextMenu.duplicateBtn.style.display = 'none';
                    document.querySelector('[data-action="save-as-template"]').style.display = 'none';

                    if (!itemWrapper && e.target.closest('#collections-list-container')) {
                        app.contextMenu.targetId = null;
                        app.contextMenu.targetIsContainer = true;
                    } else if (itemWrapper) {
                        e.preventDefault();
                        app.contextMenu.targetId = itemWrapper.dataset.id;
                        app.contextMenu.targetIsContainer = false;
                        const { item } = findItem(app.contextMenu.targetId);
                        
                        app.contextMenu.renameBtn.style.display = 'flex';
                        app.contextMenu.deleteBtn.style.display = 'flex';
                        app.contextMenu.duplicateBtn.style.display = 'flex';

                        if (item && item.type === 'note') {
    app.contextMenu.togglePinBtn.style.display = 'flex';
    document.querySelector('[data-action="save-as-template"]').style.display = 'flex';
    app.contextMenu.pinActionText.textContent = item.pinned ? 'Unpin' : 'Pin';
}
                    } else {
                        return;
                    }

                    app.contextMenu.menu.style.top = `${e.clientY}px`;
                    app.contextMenu.menu.style.left = `${e.clientX}px`;
                    app.contextMenu.menu.classList.remove('hidden');
                    setTimeout(() => app.contextMenu.menu.classList.remove('scale-95', 'opacity-0'), 10);
                    feather.replace();
                });

                const duplicateItem = (sourceItem) => {
                    const newItem = JSON.parse(JSON.stringify(sourceItem));
                    newItem.id = generateId(sourceItem.type[0]);
                    newItem.name = `${sourceItem.name} (copy)`;
                    
                    const now = new Date().toISOString();
                    if (newItem.type === 'note') {
                        newItem.createdAt = now;
                        newItem.modifiedAt = now;
                    }

                    if (newItem.type === 'folder' && newItem.children) {
                        newItem.children = newItem.children.map(child => duplicateItem(child));
                        if (state.kanbanColumns[sourceItem.id]) {
                            state.kanbanColumns[newItem.id] = JSON.parse(JSON.stringify(state.kanbanColumns[sourceItem.id]));
                        }
                    }
                    return newItem;
                };

                app.contextMenu.menu.addEventListener('click', async e => {
    const button = e.target.closest('button');
    if (!button) return;

    closeContextMenu();

    const action = button.dataset.action;
    const id = app.contextMenu.targetId;

    let findResult, targetItem, parent, parentArray;
    if (id) {
        findResult = findItem(id);
        if (findResult) {
            targetItem = findResult.item;
            parent = findResult.parent;
            parentArray = Array.isArray(parent) ? parent : parent.children;
        }
    }

    switch (action) {
        case 'new-note':
        case 'new-folder':
            {
                const isFolder = action === 'new-folder';
                let parentId = null;
                if (targetItem) {
                    parentId = targetItem.type === 'folder' ? targetItem.id : (Array.isArray(parent) ? null : parent.id);
                }
                if (isFolder) {
                    const name = 'New Folder';
                    const newCollection = {
                        id: generateId('c'), name, type: 'folder', children: [], expanded: true
                    };
                    state.kanbanColumns[newCollection.id] = [{
                        id: generateId('col'),
                        title: 'To Do'
                    }];
                    let destArray = parentId ? findItem(parentId).item.children : state.collections;
                    destArray.unshift(newCollection);
                    saveState();
                    render();
                } else {
                    createNewNote(true, {}, parentId);
                }
                break;
            }

        case 'delete':
            {
                if (!targetItem) return;
                const message = targetItem.type === 'folder' ? 'This will delete the folder and <strong>all notes inside</strong>. This action cannot be undone.' : 'This action cannot be undone.';
                const confirmed = await showConfirm({
                    title: `Delete "${targetItem.name}"`,
                    message: message,
                    confirmText: 'Delete'
                });
                if (confirmed) {
                    const index = parentArray.findIndex(i => i.id === id);
                    parentArray.splice(index, 1);
                    showToast(`"${targetItem.name}" deleted.`);
                    if (state.settings.activeNoteId === id) state.settings.activeNoteId = null;
                    if (state.settings.activeCollectionId === id) state.settings.activeCollectionId = null;
                    saveState();
                    buildLunrIndex();
                    render();
                }
                break;
            }

        case 'rename':
            {
                if (!targetItem) return;
                const newName = await showPrompt({
                    title: 'Rename',
                    message: `Enter a new name for "${targetItem.name}":`,
                    initialValue: targetItem.name
                });
                if (newName && newName !== targetItem.name) {
                    targetItem.name = newName;
                    if (targetItem.type === 'note') {
                        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
                        const noteRef = doc(db, "notes", targetItem.id);
                        await updateDoc(noteRef, { name: newName });
                    }
                    saveState();
                    buildLunrIndex();
                    render();
                }
                break;
            }

        case 'toggle-pin':
            {
                if (targetItem && targetItem.type === 'note') {
                    targetItem.pinned = !targetItem.pinned;
                    showToast(targetItem.pinned ? `Pinned "${targetItem.name}"` : `Unpinned "${targetItem.name}"`);
                    saveState();
                    render();
                }
                break;
            }

        case 'save-as-template':
            {
                if (targetItem && targetItem.type === 'note') {
                    saveAsTemplate(targetItem);
                }
                break;
            }

        case 'duplicate':
    {
        if (!targetItem) return;

        const {
            doc,
            collection,
            writeBatch,
            getDoc
        } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        const batch = writeBatch(db);

        // --- START: FIX ---
        // This function is now async to allow fetching note data from the database.
        const duplicateRecursive = async (item) => {
            const newItemStub = JSON.parse(JSON.stringify(item));
            const newId = generateId(item.type[0]);
            newItemStub.id = newId;
            newItemStub.name = `${item.name} (copy)`;

            if (item.type === 'note') {
                let sourceNoteData = window.noteCache[item.id];
                if (!sourceNoteData) {
                    // Fetch the note's content if it's not already loaded.
                    const noteRef = doc(db, "notes", item.id);
                    const noteSnap = await getDoc(noteRef);
                    if (noteSnap.exists()) {
                        sourceNoteData = noteSnap.data();
                    } else {
                        // If the note somehow doesn't exist in the DB, create an empty duplicate.
                        sourceNoteData = {
                            content: '',
                            properties: {}
                        };
                    }
                }

                const now = new Date().toISOString();
                const newNoteData = {
                    ...sourceNoteData,
                    name: newItemStub.name,
                    createdAt: now,
                    modifiedAt: now,
                    sharedWith: [] // Duplicates are not shared by default
                };
                const newNoteRef = doc(db, "notes", newId);
                batch.set(newNoteRef, newNoteData);

            } else if (item.type === 'folder') {
                if (state.kanbanColumns[item.id]) {
                    state.kanbanColumns[newId] = JSON.parse(JSON.stringify(state.kanbanColumns[item.id]));
                }
                if (item.children) {
                    // This now correctly handles duplicating folders with notes inside.
                    newItemStub.children = await Promise.all(item.children.map(child => duplicateRecursive(child)));
                }
            }
            return newItemStub;
        };
        // --- END: FIX ---

        const newItem = await duplicateRecursive(targetItem); // Await the result
        parentArray.splice(findResult.index + 1, 0, newItem);

        await batch.commit();
        saveState();
        buildLunrIndex();
        render();
        showToast(`Duplicated "${targetItem.name}"`);
        break;
    }
    }
});
                
                const closeContextMenu = () => {
                    app.contextMenu.menu.classList.add('scale-95', 'opacity-0');
                    setTimeout(() => app.contextMenu.menu.classList.add('hidden'), 100);
                };
                
                document.getElementById('bookmarklet-info-btn').addEventListener('click', () => {
                    const code = `javascript:(()=>{const data=JSON.stringify({url:location.href,title:document.title,clip:window.getSelection().toString()});window.open('${window.location.origin + window.location.pathname}#clip='+encodeURIComponent(data),'_blank');})();`;
                    app.modals.bookmarkletLink.href = code;
                    openModal(app.modals.bookmarklet);
                    feather.replace();
                });
                app.modals.bookmarkletCloseBtn.addEventListener('click', () => closeModal(app.modals.bookmarklet));

                app.elements.notesListPane.addEventListener('click', async e => {
    const button = e.target.closest('button[data-action]');
    if (!button) return;
    const action = button.dataset.action;

    if (action === 'export') {
        const toastId = showToast('Preparing export... This may take a moment.', 'loading');

        try {
            // Step 1: Ensure all notes are loaded from Firestore into the cache.
            const allNoteStubs = getAllNotes(state.collections);
            const notesToLoad = allNoteStubs.filter(stub => !window.noteCache[stub.id]);

            if (notesToLoad.length > 0) {
                const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
                const fetchPromises = notesToLoad.map(stub => {
                    const noteRef = doc(db, "notes", stub.id);
                    return getDoc(noteRef).then(noteSnap => {
                        if (noteSnap.exists()) { window.noteCache[stub.id] = noteSnap.data(); }
                    });
                });
                await Promise.all(fetchPromises);
            }

            // Step 2: Create a full state object for export by combining stubs and cached data.
            const stateForExport = JSON.parse(JSON.stringify(state)); // Deep copy to avoid modifying live state
            const populateNotes = (items) => {
                for (let i = 0; i < items.length; i++) {
                    if (items[i].type === 'note') {
                        const fullNoteData = window.noteCache[items[i].id];
                        if (fullNoteData) {
                            // Merge the full data into the stub, creating a complete note object
                            Object.assign(items[i], fullNoteData);
                        }
                    } else if (items[i].type === 'folder' && items[i].children) {
                        populateNotes(items[i].children);
                    }
                }
            };
            populateNotes(stateForExport.collections);

            // Step 3: Stringify and download the complete data object.
            const dataStr = JSON.stringify(stateForExport, null, 2);
            const dataBlob = new Blob([dataStr], {type: "application/json"});
            const url = URL.createObjectURL(dataBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `reputifly-notes-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            dismissToast(toastId);
            showToast('✅ Data exported successfully!', 'success');

        } catch (error) {
            dismissToast(toastId);
            console.error("Export failed:", error);
            showToast('❌ Failed to load all note data for export.', 'error');
        }
    }

    if (action === 'import') {
        app.elements.importFileInput.click();
    }
});

                // This replaces the entire 'change' event listener for the import file input

app.elements.importFileInput.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;

    const confirmed = await showConfirm({
        title: 'Import Data',
        message: 'This will <strong>overwrite all current data</strong> in this app. This action cannot be undone. Are you sure you want to continue?',
        confirmText: 'Overwrite and Import',
        confirmClass: 'bg-orange-500'
    });

    if (!confirmed) {
        app.elements.importFileInput.value = ''; // Reset file input
        return;
    }

    const toastId = showToast('Importing data... Do not close this tab.', 'loading');

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const importedState = JSON.parse(event.target.result);
            const user = window.auth.currentUser;
            if (!user) {
                dismissToast(toastId);
                showToast('❌ You must be logged in to import data.', 'error');
                return;
            }

            // 1. Extract full note data and create a separate dictionary for it.
            const allImportedNotes = getAllNotes(importedState.collections);
            const fullNoteDataById = {};
            allImportedNotes.forEach(note => {
                const { content, excerpt, properties, createdAt, modifiedAt, tags, links, sharedWith, ownerId, ...stub } = note;
                // Important: Ensure all imported notes are re-assigned to the current user.
                fullNoteDataById[stub.id] = { content, excerpt, properties, createdAt, modifiedAt, tags, links, sharedWith: [], ownerId: user.uid, name: stub.name };
            });

            // 2. Create the "scrubbed" state object that only contains note stubs, not full content.
            const newStateForStubs = migrateState(importedState);
            const scrubStubs = (items) => {
                items.forEach(item => {
                    if (item.type === 'note') {
                        // Keep only the keys that belong in a stub.
                        const stubKeys = ['id', 'type', 'name', 'excerpt', 'pinned', 'status'];
                        Object.keys(item).forEach(key => {
                            if (!stubKeys.includes(key)) delete item[key];
                        });
                    } else if (item.children) {
                        scrubStubs(item.children);
                    }
                });
            };
            scrubStubs(newStateForStubs.collections);

            // 3. Perform a batch write to Firestore for efficiency.
            const { doc, collection, writeBatch, deleteDoc, getDocs, query, where } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
            const batch = writeBatch(db);

            // 3a. Delete all existing notes owned by the user.
            const notesColRef = collection(db, "notes");
            const userNotesQuery = query(notesColRef, where("ownerId", "==", user.uid));
            const existingNotesSnap = await getDocs(userNotesQuery);
            existingNotesSnap.forEach(doc => batch.delete(doc.ref));

            // 3b. Add all imported notes as new documents.
            for (const noteId in fullNoteDataById) {
                const noteRef = doc(db, "notes", noteId);
                batch.set(noteRef, fullNoteDataById[noteId]);
            }

            // 3c. Overwrite the main app state with the scrubbed stub data.
            const userDocRef = doc(db, "users", user.uid, "data", "appState");
            batch.set(userDocRef, newStateForStubs);

            // 4. Commit all changes at once.
            await batch.commit();

            dismissToast(toastId);
            showToast('✅ Import complete! App will now reload.', 'success');
            setTimeout(() => window.location.reload(), 1500);

        } catch (err) {
            dismissToast(toastId);
            console.error("Import error:", err);
            showToast('❌ Invalid or corrupted data file.', 'error');
        } finally {
            app.elements.importFileInput.value = '';
        }
    };
    reader.readAsText(file);
});
                
                document.addEventListener('keydown', (e) => {
                if (e.key === ' ' && state.settings.activeNoteId) {
    const activeEl = document.activeElement;
    const isTypingElement = activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable;

    // Only run if the user is not already typing somewhere else
    if (!isTypingElement) {
        e.preventDefault(); // Prevents the page from scrolling
        const editorBody = app.elements.noteEditorBody;
        editorBody.focus();

        // Place the cursor at the very end of the existing content
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editorBody);
        range.collapse(false); // 'false' collapses the range to the end
        selection.removeAllRanges();
        selection.addRange(range);
    }
}
                    // Add this inside the existing keydown listener

                    if ((e.metaKey || e.ctrlKey) && e.key === 'u') {
    e.preventDefault();
    document.getElementById('file-upload-input').click();
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        // This re-uses the same logic as the header button
        app.elements.newCollectionBtn.click();
    }
}

                    if (e.key === 'Escape') {
                        if (isSearchActive) {
                            closeSearch();
                        }
                        closeContextMenu();
                        if (app.elements.notesListPane.classList.contains('open')) {
                            toggleMobileSidebar(false);
                        }
                    }
                    // This is the NEW, correct code to add
if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
    const editorView = document.getElementById('note-editor-view');

    // Check if the note editor is visible and you're typing in it
    if (!editorView.classList.contains('hidden') && editorView.contains(document.activeElement)) {
        e.preventDefault();
        // Show the IN-NOTE search bar and focus the input
        document.getElementById('highlight-controls').classList.remove('hidden');
        const input = document.getElementById('in-note-search-input');
        input.focus();
        input.select();
    } else if (!isSearchActive) {
        // Otherwise, if global search isn't already active, open it
        e.preventDefault();
        openSearch();
    }
}
                });
                
                document.addEventListener('click', (e) => {
                    if(!app.contextMenu.menu.contains(e.target)) closeContextMenu();
                    if(!app.containers.mobileControlsDropdown.contains(e.target) && !app.elements.mobileMoreButton.contains(e.target)) {
                        const dropdown = app.containers.mobileControlsDropdown;
                        dropdown.classList.add('scale-95', 'opacity-0');
                        setTimeout(() => dropdown.classList.add('hidden'), 100);
                    }
                });
                // --- START: New Checklist Widget Logic ---

let activeChecklistElement = null; // A reference to the .checklist-container div being edited

// Function to open the checklist editing modal
// REPLACE THE ENTIRE openChecklistModal FUNCTION
// ...WITH THIS ENTIRE FUNCTION
const openChecklistModal = (checklistContainer) => {
    activeChecklistElement = checklistContainer;
    const modal = document.getElementById('checklist-edit-modal');
    const itemsContainer = document.getElementById('checklist-modal-items');
    const titleInput = document.getElementById('checklist-modal-title-input');
    itemsContainer.innerHTML = '';

    const currentTitle = checklistContainer.querySelector('.checklist-title')?.textContent || 'Untitled Checklist';
    titleInput.value = currentTitle;

    const items = checklistContainer.querySelectorAll('.checklist-item');
    items.forEach(item => {
        const text = item.querySelector('.checklist-item-text').textContent;
        const checked = item.classList.contains('checked');
        addChecklistItemToModal(text, checked);
    });

    openModal(modal);
    feather.replace();

    // --- NEW DRAG-AND-DROP LOGIC (NO SortableJS) ---
    let draggedItem = null;

    itemsContainer.addEventListener('dragstart', (e) => {
        draggedItem = e.target.closest('.checklist-modal-item');
        if (!draggedItem) return;
        // Add a class for visual feedback while dragging
        setTimeout(() => draggedItem.classList.add('dragging'), 0);
    });

    itemsContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        const targetItem = e.target.closest('.checklist-modal-item');
        if (!targetItem || targetItem === draggedItem) return;

        const rect = targetItem.getBoundingClientRect();
        // Determine if dragging over the top or bottom half of the item
        const isAfter = e.clientY > rect.top + rect.height / 2;

        if (isAfter) {
            targetItem.after(draggedItem);
        } else {
            targetItem.before(draggedItem);
        }
    });

    itemsContainer.addEventListener('dragend', (e) => {
        if (draggedItem) {
            // Clean up the visual class
            draggedItem.classList.remove('dragging');
            draggedItem = null;
        }
    });
};
// Helper to add a new item row inside the modal
// REPLACE THE ENTIRE addChecklistItemToModal FUNCTION
// REPLACE THIS ENTIRE FUNCTION...
const addChecklistItemToModal = (text = '', checked = false) => {
    const itemsContainer = document.getElementById('checklist-modal-items');
    const newItemRow = document.createElement('div');
    // Make the entire row draggable
    newItemRow.className = 'checklist-modal-item';
    newItemRow.setAttribute('draggable', 'true');

    newItemRow.innerHTML = `
        <i data-feather="grip-vertical" class="handle text-text-tertiary"></i>
        <input type="checkbox" class="checklist-modal-item-checkbox w-5 h-5" ${checked ? 'checked' : ''}>
        <input type="text" class="flex-grow" value="${text.replace(/"/g, '&quot;')}">
        <button class="checklist-modal-item-btn" data-action="delete-item" title="Delete Item">
            <i data-feather="x" class="w-4 h-4"></i>
        </button>
    `;
    itemsContainer.appendChild(newItemRow);
    feather.replace();
};


// Function to save changes from the modal back to the editor
// REPLACE THE ENTIRE saveChecklistFromModal FUNCTION
// Function to save changes from the modal back to the editor
// REPLACE THE ENTIRE saveChecklistFromModal FUNCTION
const saveChecklistFromModal = () => {
    if (!activeChecklistElement) return;

    const modalItems = document.querySelectorAll('#checklist-modal-items .checklist-modal-item');
    const newTitle = document.getElementById('checklist-modal-title-input').value.trim() || 'Untitled Checklist';

    const newItemsHTML = Array.from(modalItems).map(itemRow => {
        const text = itemRow.querySelector('input[type="text"]').value;
        const isChecked = itemRow.querySelector('input[type="checkbox"]').checked;
        return `
            <li class="checklist-item ${isChecked ? 'checked' : ''}" data-checked="${isChecked}">
                <input type="checkbox" class="checklist-item-checkbox" ${isChecked ? 'checked' : ''} onclick="return false;">
                <span class="checklist-item-text" contenteditable="false">${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</span>
            </li>
        `;
    }).join('');

    const body = activeChecklistElement.querySelector('.checklist-body');
    const titleEl = activeChecklistElement.querySelector('.checklist-title');

    if (body) {
        body.innerHTML = newItemsHTML;
    }
    if (titleEl) {
        titleEl.textContent = newTitle;
    }
    updateChecklistProgress(activeChecklistElement);
    
    // ADD THESE TWO LINES TO TRIGGER THE SAVE INDICATOR
    isNoteDirty = true;
    updateSaveIndicator();

    saveNoteContent();
    closeModal(document.getElementById('checklist-edit-modal'));
    activeChecklistElement = null;
    showToast('Checklist updated!', 'success');
};

// Event listeners for the modal buttons
document.getElementById('checklist-modal-add-item-btn').addEventListener('click', () => {
    addChecklistItemToModal();
    // Focus the new input
    const allInputs = document.querySelectorAll('#checklist-modal-items input[type="text"]');
    allInputs[allInputs.length - 1].focus();
});

document.getElementById('checklist-modal-items').addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('[data-action="delete-item"]');
    if (deleteBtn) {
        deleteBtn.closest('.checklist-modal-item').remove();
    }
});
document.getElementById('checklist-modal-save-btn').addEventListener('click', saveChecklistFromModal);
document.getElementById('checklist-modal-cancel-btn').addEventListener('click', () => closeModal(document.getElementById('checklist-edit-modal')));
document.getElementById('checklist-modal-close-btn').addEventListener('click', () => closeModal(document.getElementById('checklist-edit-modal')));

// Main event listener for interacting with the widget in the editor
app.elements.noteEditorBody.addEventListener('click', (e) => {
    // --- START: NEW ATTACHMENT DELETE LOGIC ---
    const attachmentDeleteBtn = e.target.closest('.attachment-delete-btn');
    if (attachmentDeleteBtn) {
        e.preventDefault();
        const widget = attachmentDeleteBtn.closest('.file-attachment-widget');
        if (widget) {
            widget.remove();
            performImmediateSave();
            showToast('Attachment removed.', 'info');
        }
        return; // Stop further actions for this click
    }
    // --- END: NEW ATTACHMENT DELETE LOGIC ---
    const checklistContainer = e.target.closest('.checklist-container');
    if (!checklistContainer) return;

    const editBtn = e.target.closest('.checklist-header-btn[data-action="edit"]');
    const deleteBtn = e.target.closest('.checklist-header-btn[data-action="delete"]');
    const item = e.target.closest('.checklist-item');

    if (editBtn) {
        e.preventDefault();
        openChecklistModal(checklistContainer);
    } else if (deleteBtn) {
        e.preventDefault();
        checklistContainer.remove();
        performImmediateSave();
        showToast('Checklist deleted.', 'info');
    } else if (item) {
    e.preventDefault();
    const checkbox = item.querySelector('.checklist-item-checkbox');
    const checklistContainer = item.closest('.checklist-container');
    const isChecked = !item.classList.contains('checked');

    // Update classes and data attributes
    item.classList.toggle('checked', isChecked);
    item.dataset.checked = isChecked;

    // --- THIS IS THE FIX ---
    // Explicitly set the 'checked' attribute for reliable serialization
    if (isChecked) {
        checkbox.setAttribute('checked', 'checked');
    } else {
        checkbox.removeAttribute('checked');
    }
    // Also set the property for immediate visual feedback
    checkbox.checked = isChecked;
    // --- END OF FIX ---

    // Update progress and save
    updateChecklistProgress(checklistContainer);
    performImmediateSave();
}
});

// --- END: New Checklist Widget Logic ---
                // START: New Table Interaction Logic (Context Menu & Sorting)

// START: Final Table Interaction Logic (ALL FEATURES)

let tableContextMenu = document.getElementById('table-context-menu');
let activeTableRow = null;
let activeTableColIndex = -1;
let activeTableForAction = null;

const hideTableContextMenu = () => {
    if (tableContextMenu && !tableContextMenu.classList.contains('hidden')) {
        tableContextMenu.classList.add('scale-95', 'opacity-0');
        setTimeout(() => tableContextMenu.classList.add('hidden'), 100);
    }
};

app.elements.noteEditorBody.addEventListener('contextmenu', (e) => {
    closeContextMenu();
    const row = e.target.closest('tbody tr');
    const col = e.target.closest('thead tr:last-child th'); // Target the actual header row

    if (row || col) {
        e.preventDefault();
        activeTableForAction = e.target.closest('table');
        document.querySelectorAll('.table-menu-item.with-submenu').forEach(item => item.classList.remove('hover'));

        if (row) {
            activeTableRow = row;
            document.getElementById('table-row-actions').style.display = 'block';
            document.getElementById('table-col-actions').style.display = 'none';
        } else {
            activeTableColIndex = Array.from(col.parentElement.children).indexOf(col);
            document.getElementById('table-row-actions').style.display = 'none';
            document.getElementById('table-col-actions').style.display = 'block';
        }
        
        tableContextMenu.style.top = `${e.clientY}px`;
        tableContextMenu.style.left = `${e.clientX}px`;
        tableContextMenu.classList.remove('hidden');
        setTimeout(() => {
            tableContextMenu.classList.remove('scale-95', 'opacity-0');
            feather.replace();
        }, 10);
    }
});

tableContextMenu.addEventListener('click', (e) => {
    const button = e.target.closest('[data-action]');
    if (!button || !activeTableForAction) return;

    const action = button.dataset.action;
    const colCount = activeTableForAction.querySelector('thead tr:last-child').children.length;

    // --- FIX START: Helper functions are now defined BEFORE the 'actions' object ---
    const createRow = () => {
        const currentHeaderCount = activeTableForAction.querySelector('thead tr:last-child').children.length;
        const newRow = document.createElement('tr');
        newRow.innerHTML = Array(currentHeaderCount).fill('<td contenteditable="true"><br></td>').join('');
        return newRow;
    };

    const addColumn = (index) => {
        activeTableForAction.querySelectorAll('thead tr:last-child, tbody tr').forEach(row => {
            const isHeaderRow = row.parentElement.tagName === 'THEAD';
            const cellType = isHeaderRow ? 'th' : 'td';
            const newCell = document.createElement(cellType);
            newCell.setAttribute('contenteditable', 'true');
            if (isHeaderRow) {
                newCell.classList.add('sortable-header');
                newCell.dataset.sortDir = 'none';
                newCell.textContent = 'Header';
            }
            row.insertBefore(newCell, row.children[index]);
        });
        const newColCount = activeTableForAction.querySelector('thead tr:last-child').children.length;
        const filterHeader = activeTableForAction.querySelector('thead tr:first-child th');
        if (filterHeader) {
            filterHeader.setAttribute('colspan', newColCount);
        }
    };
    // --- FIX END ---

    const actions = {
        'add-row-above': () => activeTableRow.before(createRow()),
        'add-row-below': () => activeTableRow.after(createRow()),
        'duplicate-row': () => activeTableRow.after(activeTableRow.cloneNode(true)),
        'delete-row': () => activeTableRow.remove(),
        'highlight': () => {
            const color = button.dataset.color;
            activeTableRow.className = ''; // Clear other colors
            if (color !== 'none') activeTableRow.classList.add(`bg-highlight-${color}`);
        },
        'add-col-left': () => addColumn(activeTableColIndex),
        'add-col-right': () => addColumn(activeTableColIndex + 1),
        'duplicate-col': () => {
            activeTableForAction.querySelectorAll('tr').forEach(row => {
                const cellToClone = row.children[activeTableColIndex];
                if (cellToClone) cellToClone.after(cellToClone.cloneNode(true));
            });
        },
        'delete-col': () => {
            if (colCount <= 1) return showToast("Cannot delete the last column.", "error");
            activeTableForAction.querySelectorAll('tr').forEach(row => row.children[activeTableColIndex]?.remove());
        },
        'calculate': () => {
            const type = button.dataset.calc;
            let tfoot = activeTableForAction.querySelector('tfoot');
            if (!tfoot) {
                tfoot = activeTableForAction.createTFoot();
                const newRow = tfoot.insertRow(0);
                for (let i = 0; i < colCount; i++) {
                    const newCell = newRow.insertCell();
                    newCell.contentEditable = false;
                }
            }
            const footerCell = tfoot.rows[0].cells[activeTableColIndex];

            if (type === 'clear') {
                footerCell.innerHTML = '';
                footerCell.removeAttribute('data-calc-type');
                const allFooterCells = Array.from(footerCell.parentElement.children);
                const hasOtherCalcs = allFooterCells.some(cell => cell.hasAttribute('data-calc-type'));
                if (!hasOtherCalcs) {
                    tfoot.remove();
                }
            } else {
                footerCell.dataset.calcType = type;
                performStandardCalculation(activeTableForAction, activeTableColIndex, type);
            }
        },
        'custom-calc': async () => {
            const targetHeader = activeTableForAction.querySelector(`thead tr:last-child th:nth-child(${activeTableColIndex + 1})`);
            const existingFormula = targetHeader?.dataset.formula || '';

            const formula = await showPrompt({
                title: 'Custom Column Formula',
                message: 'Enter formula using column names (e.g., Cost * Quantity) or letters (A-Z).',
                placeholder: 'e.g., Cost * 0.07',
                initialValue: existingFormula
            });

            if (formula === null) return;
            
            if (targetHeader) {
                targetHeader.dataset.formula = formula;
                performCustomFormula(activeTableForAction, activeTableColIndex, formula);
                if (formula) {
                   showToast(`Live formula updated.`, 'success');
                } else {
                   showToast(`Formula cleared for column.`, 'info');
                }
            }
        },
    };

    if (actions[action]) {
        actions[action]();
        saveNoteContent();
        hideTableContextMenu();
    }
});

app.elements.noteEditorBody.addEventListener('click', (e) => {
// Add this block inside the noteEditorBody 'click' event listener

    const toggleBtn = e.target.closest('.toggle-filter-btn');
    if (toggleBtn) {
        e.preventDefault();
        const table = toggleBtn.closest('table');
        if (table) {
            table.classList.toggle('filter-collapsed');
            saveNoteContent(); // Save the new state of the table
        }
        return; // Stop further actions
    }
    const sortableHeader = e.target.closest('th.sortable-header');
    if (sortableHeader) {
        const table = sortableHeader.closest('table');
        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        const headerRow = sortableHeader.parentElement;
        const headers = Array.from(headerRow.children);
        const colIndex = headers.indexOf(sortableHeader);
        
        const currentDir = sortableHeader.dataset.sortDir;
        const newDir = currentDir === 'asc' ? 'desc' : (currentDir === 'desc' ? 'none' : 'asc');

        // Store original order if it's the first time sorting this table
        if (!table._originalRows) {
            table._originalRows = Array.from(tbody.querySelectorAll('tr'));
        }

        if (newDir === 'none') {
            tbody.append(...table._originalRows); // Revert to original order
        } else {
            let rows = Array.from(tbody.querySelectorAll('tr'));
            // Validation logic
            const firstCellText = rows.length > 0 ? rows[0].children[colIndex]?.innerText.trim() : '';
            const isNumericColumn = firstCellText && isFinite(firstCellText.replace(/[^0-9.-]+/g, ""));
            
            let canSort = true;
            if (isNumericColumn) {
                for (let row of rows) {
                    const cellText = row.children[colIndex]?.innerText.trim();
                    if (cellText && !isFinite(cellText.replace(/[^0-9.-]+/g, ""))) {
                        canSort = false;
                        break;
                    }
                }
            }
            if(!canSort) return showToast("Cannot sort: column contains mixed data types.", "error");

            // Perform sort
            rows.sort((rowA, rowB) => {
                const cellA = rowA.children[colIndex]?.innerText.trim() || '';
                const cellB = rowB.children[colIndex]?.innerText.trim() || '';
                if (isNumericColumn) {
                    const numA = parseFloat(cellA.replace(/[^0-9.-]+/g, "")) || 0;
                    const numB = parseFloat(cellB.replace(/[^0-9.-]+/g, "")) || 0;
                    return newDir === 'asc' ? numA - numB : numB - numA;
                }
                return newDir === 'asc' ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
            });
            tbody.append(...rows);
        }

        headers.forEach(th => {
            th.dataset.sortDir = 'none';
            th.querySelector('.sort-indicator')?.remove();
        });
        if(newDir !== 'none') {
            sortableHeader.dataset.sortDir = newDir;
            sortableHeader.insertAdjacentHTML('beforeend', `<span class="sort-indicator">${newDir === 'asc' ? '▲' : '▼'}</span>`);
        }
        saveNoteContent();
    }
});

// Column Resizing Logic
app.elements.noteEditorBody.addEventListener('mousedown', (e) => {
    const header = e.target.closest('th');
    if (header) {
        const rect = header.getBoundingClientRect();
        // Check if the click is on the right border of the header
        if (rect.width - e.offsetX < 10) { 
            const table = header.closest('table');
            const startX = e.clientX;
            const startWidth = rect.width;

            const handleMouseMove = (moveEvent) => {
                const newWidth = startWidth + (moveEvent.clientX - startX);
                if (newWidth > 40) { // Minimum width
                    header.style.width = `${newWidth}px`;
                }
            };
            const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
                saveNoteContent();
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }
    }
});
// --- NEW: Live Calculation Trigger ---
app.elements.noteEditorBody.addEventListener('input', (e) => {
    // Check if the edit happened inside a table cell
    const cell = e.target.closest('td');
    if (cell) {
        const table = cell.closest('table');
        if (table) {
            // Use the debounced function to update calculations
            debouncedLiveCalculate(table);
        }
    }
});
// Table Filtering Logic
// Fuzzy Table Filtering Logic
app.elements.noteEditorBody.addEventListener('input', (e) => {
    const filterInput = e.target.closest('.table-filter-input');
    if(filterInput) {
        const table = filterInput.closest('table');
        const tbody = table.querySelector('tbody');
        const filterText = filterInput.value; // No need for toLowerCase() with Fuse.js

        const rows = Array.from(tbody.querySelectorAll('tr'));

        // If the filter is empty, show all rows and exit
        if (!filterText.trim()) {
            rows.forEach(row => row.style.display = '');
            return;
        }

        // Get all rows to create the search data
        const searchData = rows.map((row, index) => ({
            id: index, // Use index as a reference
            text: row.innerText
        }));

        // Configure Fuse.js for fuzzy searching
        const fuseOptions = {
            keys: ['text'],
            includeScore: true,
            threshold: 0.4 // Adjust threshold for desired fuzziness (0.0 = perfect match, 1.0 = match anything)
        };
        const fuse = new Fuse(searchData, fuseOptions);

        // Perform the search
        const results = fuse.search(filterText);
        const visibleRowIds = new Set(results.map(result => result.item.id));

        // Show/hide rows based on search results
        rows.forEach((row, index) => {
            row.style.display = visibleRowIds.has(index) ? '' : 'none';
        });
    }
});

// Global listener to hide menus
document.addEventListener('click', (e) => {
    if (!e.target.closest('#table-context-menu')) hideTableContextMenu();
    if (!e.target.closest('#context-menu')) closeContextMenu();
});
// --- START: NEW Live Calculation Logic ---

/**
 * A debounced function to trigger live updates for a table.
 * This prevents calculations from running on every single keystroke.
 */
const debouncedLiveCalculate = debounce((table) => {
    updateTableCalculations(table);
}, 400); // 400ms delay

/**
 * Main function to update all calculations for a given table.
 * It checks for both footer calculations (sum, avg) and custom column formulas.
 */
function updateTableCalculations(table) {
    if (!table) return;

    // 1. Update footer calculations (Sum, Average, Count)
    const tfoot = table.querySelector('tfoot');
    if (tfoot) {
        tfoot.querySelectorAll('td[data-calc-type]').forEach((cell, index) => {
            performStandardCalculation(table, index, cell.dataset.calcType);
        });
    }

    // 2. Update custom formula columns
    table.querySelectorAll('thead th[data-formula]').forEach((header, index) => {
        performCustomFormula(table, index, header.dataset.formula);
    });
    
    // This ensures the note is saved after calculations are updated
    saveNoteContent();
}

/**
 * Performs a standard calculation (sum, avg, count) for a specific column.
 */
function performStandardCalculation(table, colIndex, calcType) {
    const tfoot = table.querySelector('tfoot');
    if (!tfoot || !calcType) return;
    
    const footerCell = tfoot.rows[0].cells[colIndex];
    if (!footerCell) return;

    const values = Array.from(table.querySelectorAll('tbody tr'))
        .map(row => parseFloat(row.children[colIndex]?.innerText.replace(/[^0-9.-]+/g, "")))
        .filter(n => !isNaN(n));

    if (values.length === 0) {
        footerCell.innerHTML = ''; // Clear if no numbers
        return;
    }

    let result = '';
    if (calcType === 'sum') result = `Sum: ${values.reduce((a, b) => a + b, 0).toLocaleString()}`;
    if (calcType === 'avg') result = `Avg: ${(values.reduce((a, b) => a + b, 0) / values.length).toLocaleString(undefined, {maximumFractionDigits: 2})}`;
    if (calcType === 'count') result = `Count: ${values.length}`;
    footerCell.textContent = result;
}

/**
 * Applies a custom formula to every row in a target column.
 */
function performCustomFormula(table, targetColIndex, formula) {
    const headers = Array.from(table.querySelectorAll('thead tr:last-child th'))
        .map(th => th.innerText.trim());

    const formulaRegex = /(.+?)\s*([+\-*/])\s*(.+)/;
    const match = formula.match(formulaRegex);
    if (!match) return; // Invalid formula stored

    const [, col1Raw, operator, col2Raw] = match.map(s => s.trim());

    const getIndex = (operand) => {
        let op = operand.replace(/[()]/g, '').trim();
        // 1. Check by Header Name (case-insensitive)
        const lowerOp = op.toLowerCase();
        const headerIndex = headers.findIndex(h => h.toLowerCase() === lowerOp);
        if (headerIndex !== -1) return headerIndex;

        // 2. Fallback to Letter (A, B, C...)
        if (/^[A-Z]$/i.test(op)) return op.toUpperCase().charCodeAt(0) - 65;

        return -1; // Not found
    };

    const col1Index = getIndex(col1Raw);
    const col2Index = getIndex(col2Raw);
    const col2Value = (col2Index === -1) ? parseFloat(col2Raw.replace(/[$,]/g, '')) : null;

    if (col1Index === -1 || (col2Index === -1 && isNaN(col2Value))) return; // Invalid columns in formula

    table.querySelectorAll('tbody tr').forEach(row => {
        const getNumericValue = (index) => parseFloat(row.children[index]?.innerText.replace(/[$,]/g, ''));
        const val1 = getNumericValue(col1Index);
        const val2 = col2Index !== -1 ? getNumericValue(col2Index) : col2Value;
        const targetCell = row.children[targetColIndex];

        if (isNaN(val1) || isNaN(val2) || !targetCell) {
            if(targetCell) targetCell.innerText = '';
            return;
        }

        let result;
        switch (operator) {
            case '+': result = val1 + val2; break;
            case '-': result = val1 - val2; break;
            case '*': result = val1 * val2; break;
            case '/': result = val2 !== 0 ? val1 / val2 : 'Error'; break;
            default: return;
        }
        targetCell.innerText = typeof result === 'number' ? result.toLocaleString(undefined, { maximumFractionDigits: 2 }) : result;
    });
}
// --- END: NEW Live Calculation Logic ---

// END: Final Table Interaction Logic

// END: New Table Interaction Logic

                render();
            }

            // Add this inside your init() function

// --- START: Save on Exit/Reload Logic ---
window.addEventListener('beforeunload', (e) => {
    // Check if there's an active note being edited
    if (state.settings.activeNoteId) {
        // Use the performImmediateSave function to bypass the debounce timer
        // This ensures the very latest content is saved before the page closes.
        performImmediateSave();
    }
});
// --- END: Save on Exit/Reload Logic ---
        });
        // START: Interactive Table Logic
app.elements.noteEditorBody.addEventListener('click', async (e) => {
    // Add this block inside the noteEditorBody 'click' event listener

    const deleteBtn = e.target.closest('.delete-row-btn');
    const duplicateBtn = e.target.closest('.duplicate-row-btn');
    const sortableHeader = e.target.closest('th.sortable-header');

    // Row Deletion
    if (deleteBtn) {
        e.preventDefault();
        const row = deleteBtn.closest('tr');
        if (row) {
            const confirmed = await showConfirm({
                title: 'Delete Row',
                message: 'Are you sure you want to delete this table row?',
                confirmText: 'Delete'
            });
            if (confirmed) {
                row.remove();
                saveNoteContent();
            }
        }
    }

    // Row Duplication
    if (duplicateBtn) {
        e.preventDefault();
        const row = duplicateBtn.closest('tr');
        if (row) {
            const newRow = row.cloneNode(true);
            row.after(newRow);
            feather.replace(); // Re-render icons on new row
            saveNoteContent();
        }
    }

    // Column Sorting
    if (sortableHeader) {
        e.preventDefault();
        const table = sortableHeader.closest('table');
        const tbody = table.querySelector('tbody');
        const headerRow = sortableHeader.closest('tr');
        const headers = Array.from(headerRow.querySelectorAll('th'));
        const colIndex = headers.indexOf(sortableHeader);

        // Do not sort the 'Actions' column
        if (colIndex === -1 || !headers[colIndex].classList.contains('sortable-header')) return;

        const rows = Array.from(tbody.querySelectorAll('tr'));
        const currentDir = sortableHeader.dataset.sortDir;
        const newDir = currentDir === 'asc' ? 'desc' : 'asc';

        rows.sort((rowA, rowB) => {
            const cellA = rowA.children[colIndex].innerText.trim();
            const cellB = rowB.children[colIndex].innerText.trim();
            const numA = parseFloat(cellA);
            const numB = parseFloat(cellB);

            let valA, valB;
            // Check if both values are valid, finite numbers
            if (!isNaN(numA) && !isNaN(numB) && isFinite(cellA) && isFinite(cellB)) {
                valA = numA;
                valB = numB;
            } else {
                valA = cellA.toLowerCase();
                valB = cellB.toLowerCase();
            }
            
            if (valA < valB) return newDir === 'asc' ? -1 : 1;
            if (valA > valB) return newDir === 'asc' ? 1 : -1;
            return 0;
        });

        // Reset other headers and update the current one
        headers.forEach(th => {
            th.dataset.sortDir = 'none';
            const indicator = th.querySelector('.sort-indicator');
            if (indicator) indicator.remove();
        });
        sortableHeader.dataset.sortDir = newDir;
        sortableHeader.insertAdjacentHTML('beforeend', `<span class="sort-indicator">${newDir === 'asc' ? '▲' : '▼'}</span>`);

        // Re-append sorted rows
        tbody.innerHTML = '';
        rows.forEach(row => tbody.appendChild(row));
        saveNoteContent();
    }
});

app.elements.noteEditorBody.addEventListener('keydown', (e) => {
    const target = e.target;
    if (!target.closest('table')) return;

    const cell = target.closest('td, th');
    // Ensure we are in an editable cell
    if (!cell || cell.contentEditable !== 'true') return;

    // Enter: Save and move down
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const currentRow = cell.parentElement;
        const nextRow = currentRow.nextElementSibling;
        if (nextRow) {
            const cellInNextRow = nextRow.children[cell.cellIndex];
            if (cellInNextRow && cellInNextRow.contentEditable === 'true') {
                cellInNextRow.focus();
            }
        }
        saveNoteContent(); // Save content on Enter
    }

    // Tab: Move to the next editable cell
    if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        const currentRow = cell.parentElement;
        let nextCell = cell.nextElementSibling;

        while (nextCell && nextCell.contentEditable !== 'true') {
            nextCell = nextCell.nextElementSibling;
        }

        if (nextCell) {
            nextCell.focus();
        } else {
            let nextRow = currentRow.nextElementSibling;
            // If we are in the header (THEAD), jump to the body (TBODY)
            if (!nextRow && currentRow.parentElement.tagName === 'THEAD') {
                nextRow = currentRow.parentElement.nextElementSibling?.firstElementChild;
            }
            
            if (nextRow) {
                let firstCellOfNextRow = nextRow.querySelector('td[contenteditable="true"], th[contenteditable="true"]');
                if (firstCellOfNextRow) {
                     firstCellOfNextRow.focus();
                }
            }
        }
    }
});
// END: Interactive Table Logic
    