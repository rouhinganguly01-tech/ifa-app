// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDjwXBOfyvNa1t-ELfV3nItc9P8Zp7TI5g",
    authDomain: "ifa-operations.firebaseapp.com",
    projectId: "ifa-operations",
    storageBucket: "ifa-operations.firebasestorage.app",
    messagingSenderId: "69838800674",
    appId: "1:69838800674:web:57ed0ddd62b28d00ddc77b",
    measurementId: "G-78JDB5L5W2"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let currentUser = null;
let allUsers = [];
let allTasks = [];
let isInitialUserLoad = true;
let isInitialTaskLoad = true;

// ----------------------------------------------------
// PUSH NOTIFICATIONS SYSTEM
// ----------------------------------------------------
function sendPushNotification(title, body) {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
        new Notification(title, { body: body, icon: 'ifa-logo.png' });
    }
}

// ----------------------------------------------------
// REAL-TIME LISTENERS (Users & Notifications)
// ----------------------------------------------------
db.collection("users").onSnapshot((snapshot) => {
    allUsers = [];
    let currentPendingCount = 0;

    snapshot.forEach((doc) => { 
        const userData = doc.data();
        allUsers.push({ id: doc.id, ...userData }); 
        if (!userData.approved) currentPendingCount++;
    });

    if (currentUser && currentUser.role === 'admin') {
        renderAdminPanel();
        
        const badge = document.getElementById('pending-badge');
        if (badge) {
            badge.innerText = currentPendingCount;
            currentPendingCount > 0 ? badge.classList.remove('hidden') : badge.classList.add('hidden');
        }

        // Detect new registrations for Admin Notification
        if (!isInitialUserLoad) {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added' && !change.doc.data().approved) {
                    sendPushNotification("IFA Admin Alert", `${change.doc.data().name} has registered and is waiting for approval.`);
                }
            });
        }
    }
    isInitialUserLoad = false;
});

// REAL-TIME LISTENERS (Tasks & Notifications)
db.collection("tasks").orderBy("timestamp", "desc").onSnapshot((snapshot) => {
    allTasks = [];
    snapshot.forEach((doc) => { allTasks.push({ id: doc.id, ...doc.data() }); });
    
    if (currentUser) {
        renderTasks();

        // Detect task changes to trigger notifications
        if (!isInitialTaskLoad) {
            snapshot.docChanges().forEach((change) => {
                const data = change.doc.data();
                
                // Don't notify the person who actually clicked the button
                if (data.lastUpdatedBy === currentUser.name) return;

                if (change.type === 'added') {
                    if (data.assignee === currentUser.name) {
                        sendPushNotification("New Task Assigned", `Topic: ${data.topic}`);
                    }
                }
                
                if (change.type === 'modified') {
                    if (currentUser.role === 'admin') {
                        sendPushNotification("Task Status Updated", `${data.assignee} updated status for: ${data.topic}`);
                    } else if (data.assignee === currentUser.name) {
                        sendPushNotification("Task Modified", `Admin updated your task: ${data.topic}`);
                    }
                }
            });
        }
    }
    isInitialTaskLoad = false;
});

// Seed default Super Admin
setTimeout(() => {
    if (allUsers.length === 0) {
        db.collection("users").add({
            name: 'Anirban Dutta', phone: '9830034595', password: 'Luis@007',
            dept: 'Administration', role: 'admin', approved: true
        });
    }
}, 1000);

// ----------------------------------------------------
// AUTHENTICATION LOGIC
// ----------------------------------------------------
function toggleAuth(isRegister) {
    document.getElementById('login-form').classList.toggle('hidden', isRegister);
    document.getElementById('register-form').classList.toggle('hidden', !isRegister);
}

function handleRegister() {
    const name = document.getElementById('reg-name').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const password = document.getElementById('reg-pass').value.trim();
    const dept = document.getElementById('reg-dept').value;

    if(!name || !phone || !password) { alert('Please fill in all fields.'); return; }
    if(allUsers.some(u => u.phone === phone)) { alert('Mobile number already registered.'); return; }

    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('waiting-screen').classList.remove('hidden');
    setTimeout(() => { alert('Submitted for approval.'); }, 150);

    db.collection("users").add({ name, phone, password, dept, role: 'staff', approved: false })
      .catch(err => {
          alert('Error: ' + err.message);
          document.getElementById('waiting-screen').classList.add('hidden');
          document.getElementById('auth-screen').classList.remove('hidden');
      });
}

function handleLogin() {
    const phone = document.getElementById('login-phone').value.trim();
    const password = document.getElementById('login-pass').value.trim();
    const user = allUsers.find(u => u.phone === phone && u.password === password);

    if(!user) { 
        const unapproved = allUsers.find(u => u.phone === phone);
        if(unapproved && !unapproved.approved) {
            document.getElementById('auth-screen').classList.add('hidden');
            document.getElementById('waiting-screen').classList.remove('hidden');
            return;
        }
        alert('Invalid mobile number or password.'); return;
    }
    if(!user.approved) {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('waiting-screen').classList.remove('hidden');
        return;
    }
    currentUser = user;
    loadDashboard();
}

function loadDashboard() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('waiting-screen').classList.add('hidden');
    document.getElementById('dashboard-screen').classList.remove('hidden');
    document.getElementById('welcome-title').innerText = `${currentUser.name} (${currentUser.dept})`;

    document.getElementById('admin-controls').classList.add('hidden');
    document.getElementById('task-allocation-section').classList.add('hidden');
    document.getElementById('edit-task-modal').classList.add('hidden');

    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }

    if(currentUser.role === 'admin') {
        document.getElementById('admin-panel-btn').classList.remove('hidden');
        document.getElementById('task-alloc-btn').classList.remove('hidden');
        renderAdminPanel();
    } else {
        document.getElementById('admin-panel-btn').classList.add('hidden');
        document.getElementById('task-alloc-btn').classList.add('hidden');
    }
    renderTasks();
}

// ----------------------------------------------------
// UI TOGGLES
// ----------------------------------------------------
function toggleAdminPanel() {
    const adminPanel = document.getElementById('admin-controls');
    if (adminPanel.classList.contains('hidden')) {
        adminPanel.classList.remove('hidden');
        document.getElementById('task-allocation-section').classList.add('hidden');
        document.getElementById('edit-task-modal').classList.add('hidden');
    } else { adminPanel.classList.add('hidden'); }
}

function toggleTaskAllocation() {
    const taskPanel = document.getElementById('task-allocation-section');
    if (taskPanel.classList.contains('hidden')) {
        taskPanel.classList.remove('hidden');
        document.getElementById('admin-controls').classList.add('hidden');
        document.getElementById('edit-task-modal').classList.add('hidden');
    } else { taskPanel.classList.add('hidden'); }
}

// ----------------------------------------------------
// ADMIN OPERATIONS
// ----------------------------------------------------
function changePassword() {
    const currentPass = document.getElementById('current-pass').value.trim();
    const newPass = document.getElementById('new-pass').value.trim();
    if(!currentPass || !newPass) { alert("Please fill in both fields."); return; }
    if(currentPass !== currentUser.password) { alert("Incorrect current password."); return; }

    db.collection("users").doc(currentUser.id).update({ password: newPass }).then(() => {
        currentUser.password = newPass; 
        document.getElementById('current-pass').value = ''; document.getElementById('new-pass').value = '';
        alert("Password updated successfully!");
    });
}

function renderAdminPanel() {
    const pendingList = document.getElementById('pending-list');
    const activeList = document.getElementById('active-list');
    const allocSelect = document.getElementById('task-assignee');
    const editSelect = document.getElementById('edit-task-assignee');
    
    pendingList.innerHTML = ''; activeList.innerHTML = '';
    allocSelect.innerHTML = ''; editSelect.innerHTML = '';

    let hasPending = false, hasActive = false;

    allUsers.forEach((u) => {
        if(!u.approved) {
            hasPending = true;
            pendingList.innerHTML += `
                <div style="padding:10px; background:#f9f9f9; border:1px solid #ddd; margin-bottom:5px; border-radius:4px;">
                    <b>${u.name}</b> (${u.dept}) - ${u.phone}<br>
                    <button class="status-btn" onclick="approveUser('${u.id}')" style="background:#1b4d3e;">Approve</button>
                    <button class="status-btn danger-btn" onclick="removeUser('${u.id}')">Reject</button>
                </div>
            `;
        }
        if(u.approved) {
            let deleteBtn = u.phone === '9830034595' ? `<small style="color:#c0392b; margin-left:10px;">(Super Admin)</small>` : `<button class="status-btn danger-btn" style="padding:4px 8px; float:right;" onclick="removeUser('${u.id}')">Remove</button>`;
            hasActive = true;
            activeList.innerHTML += `<div style="padding:10px; background:#f9f9f9; border:1px solid #ddd; margin-bottom:5px; border-radius:4px; overflow:hidden;"><b>${u.name}</b> (${u.dept}) ${deleteBtn}</div>`;
            const optionHTML = `<option value="${u.name}">${u.name} (${u.dept})</option>`;
            allocSelect.innerHTML += optionHTML;
            editSelect.innerHTML += optionHTML;
        }
    });

    if(!hasPending) pendingList.innerHTML = '<p style="color:#888; font-size:13px; margin:0;">No pending requests.</p>';
    if(!hasActive) activeList.innerHTML = '<p style="color:#888; font-size:13px; margin:0;">No active staff.</p>';
}

function approveUser(docId) { db.collection("users").doc(docId).update({ approved: true }); }
function removeUser(docId) { if(confirm("Permanently remove this user?")) { db.collection("users").doc(docId).delete(); } }

// ----------------------------------------------------
// TASK ALLOCATION & EDITING
// ----------------------------------------------------
function createTask() {
    const topicInput = document.getElementById('task-topic');
    const titleInput = document.getElementById('task-title');
    const assignee = document.getElementById('task-assignee').value;
    
    const topic = topicInput.value.trim();
    const title = titleInput.value.trim();
    
    if(!topic || !title) { alert('Please enter both a Topic and a Description.'); return; }

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    topicInput.value = ''; titleInput.value = '';
    document.getElementById('task-allocation-section').classList.add('hidden');

    db.collection("tasks").add({
        topic, title, assignee, status: 'Pending', allottedDate: `${dateStr} at ${timeStr}`,
        reportedTo: currentUser.name, 
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        lastUpdatedBy: currentUser.name // Tracks who made the change for notifications
    }).then(() => {
        setTimeout(() => { alert('Task assigned successfully!'); }, 150);
    });
}

function openEditTask(docId, topic, title, assignee) {
    document.getElementById('edit-task-modal').classList.remove('hidden');
    document.getElementById('task-allocation-section').classList.add('hidden');
    document.getElementById('admin-controls').classList.add('hidden');
    
    document.getElementById('edit-task-id').value = docId;
    document.getElementById('edit-task-topic').value = topic;
    document.getElementById('edit-task-title').value = title;
    document.getElementById('edit-task-assignee').value = assignee;
    window.scrollTo(0, 0); 
}

function cancelEditTask() { document.getElementById('edit-task-modal').classList.add('hidden'); }

function saveEditTask() {
    const docId = document.getElementById('edit-task-id').value;
    const topicInput = document.getElementById('edit-task-topic');
    const titleInput = document.getElementById('edit-task-title');
    const newAssignee = document.getElementById('edit-task-assignee').value;
    
    const newTopic = topicInput.value.trim();
    const newTitle = titleInput.value.trim();
    
    if(!newTopic || !newTitle) { alert('Topic and Description cannot be empty.'); return; }

    topicInput.value = ''; titleInput.value = '';
    cancelEditTask();

    db.collection("tasks").doc(docId).update({ 
        topic: newTopic, title: newTitle, assignee: newAssignee,
        lastUpdatedBy: currentUser.name 
    }).then(() => {
        setTimeout(() => { alert("Task updated successfully!"); }, 150);
    });
}

function deleteAdminTask(docId) {
    if(confirm("Are you sure you want to permanently delete this task?")) {
        db.collection("tasks").doc(docId).delete();
    }
}

// ----------------------------------------------------
// ACCORDION RENDERING
// ----------------------------------------------------
function toggleTaskBody(taskId) {
    const body = document.getElementById(`body-${taskId}`);
    const wrapper = document.getElementById(`wrapper-${taskId}`);
    if (body.classList.contains('hidden')) {
        body.classList.remove('hidden');
        wrapper.classList.add('expanded');
    } else {
        body.classList.add('hidden');
        wrapper.classList.remove('expanded');
    }
}

function renderTasks() {
    const taskList = document.getElementById('task-list');
    taskList.innerHTML = '';
    let count = 0;

    allTasks.forEach((t) => {
        if(currentUser.role === 'admin' || t.assignee === currentUser.name) {
            count++;
            
            let statusColor = '#c0392b'; 
            let blinkerClass = '';
            if (t.status === 'In Progress') { statusColor = '#f39c12'; blinkerClass = 'active-pulse'; } 
            else if (t.status === 'Completed') { statusColor = '#27ae60'; }

            const topicDisplay = t.topic || 'General Task';
            const dateDisplay = t.allottedDate || 'Unknown Date';
            const reporterDisplay = t.reportedTo || 'Admin';

            let adminButtons = '';
            if(currentUser.role === 'admin') {
                const safeTopic = topicDisplay.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                const safeTitle = t.title.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                adminButtons = `
                    <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #eee; display: flex; gap: 5px;">
                        <button class="btn-small btn-edit" onclick="openEditTask('${t.id}', '${safeTopic}', '${safeTitle}', '${t.assignee}')">✏️ Edit</button>
                        <button class="btn-small btn-delete" onclick="deleteAdminTask('${t.id}')">🗑️ Delete</button>
                    </div>
                `;
            }

            taskList.innerHTML += `
                <div class="task-card-wrapper" id="wrapper-${t.id}">
                    <div class="task-header" onclick="toggleTaskBody('${t.id}')">
                        <span class="task-topic-text">${topicDisplay}</span>
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <span style="background:${statusColor}; color:white; padding:4px 8px; border-radius:12px; font-weight:bold; font-size:10px; display: flex; align-items: center;">
                                <span class="blinker ${blinkerClass}"></span> ${t.status}
                            </span>
                            <span class="expand-icon">▼</span>
                        </div>
                    </div>
                    
                    <div class="task-body hidden" id="body-${t.id}">
                        <div style="font-size: 14px; color: #333; margin-bottom: 12px; line-height: 1.5;">
                            <b>Description:</b><br>${t.title}
                        </div>
                        
                        <div style="font-size: 13px; color: #444; line-height: 1.6; background: #f0f4f8; padding: 10px; border-radius: 4px;">
                            <div>👤 <b>Allotted To:</b> ${t.assignee}</div>
                            <div>📅 <b>Allotted On:</b> ${dateDisplay}</div>
                            <div>👔 <b>Reported To:</b> ${reporterDisplay}</div>
                        </div>

                        <button class="status-btn" onclick="toggleStatus('${t.id}', '${t.status}')" style="margin-top: 12px; width: 100%;">Update Task Status</button>
                        ${adminButtons}
                    </div>
                </div>
            `;
        }
    });

    if(count === 0) taskList.innerHTML = `<p style="color:#666; font-size:14px; text-align: center; margin-top: 20px;">No tasks currently assigned.</p>`;
}

function toggleStatus(docId, currentStatus) {
    const statuses = ['Pending', 'In Progress', 'Completed'];
    let currentIdx = statuses.indexOf(currentStatus);
    let nextStatus = statuses[(currentIdx + 1) % statuses.length];
    db.collection("tasks").doc(docId).update({ 
        status: nextStatus,
        lastUpdatedBy: currentUser.name 
    });
}

function logout() {
    currentUser = null;
    document.getElementById('dashboard-screen').classList.add('hidden');
    document.getElementById('waiting-screen').classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('login-phone').value = '';
    document.getElementById('login-pass').value = '';
}