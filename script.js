/* Central client-side editor script
   - Handles forms with class `.edit-form`: saves data to localStorage under keys like `page:projects`
   - Provides a small helper `renderPageData()` for pages to call on load to populate DOM
*/

function saveFormData(page, index, data) {
	const key = `page:${page}`;
	const all = JSON.parse(localStorage.getItem(key) || '[]');
	all[index] = data;
	localStorage.setItem(key, JSON.stringify(all));
}

function getPageData(page) {
	return JSON.parse(localStorage.getItem(`page:${page}`) || '[]');
}

function setupEditForms() {
	document.querySelectorAll('.edit-form').forEach(form => {
		// setup image preview for any file inputs inside the form
		form.querySelectorAll('input[type=file]').forEach(fileInput => {
			// expect an img with id `${fileInput.id}-preview` already in the DOM
			const previewId = (fileInput.id || '') + '-preview';
			const previewEl = document.getElementById(previewId) || fileInput.nextElementSibling;
			fileInput.addEventListener('change', () => {
				const f = fileInput.files[0];
				if (!f) {
					if (previewEl && previewEl.tagName === 'IMG') previewEl.style.display = 'none';
					return;
				}
				const reader = new FileReader();
				reader.onload = e => {
					if (previewEl && previewEl.tagName === 'IMG') {
						previewEl.src = e.target.result;
						previewEl.style.display = 'block';
					}
				};
				reader.readAsDataURL(f);
			});
		});

		form.addEventListener('submit', e => {
			e.preventDefault();
			const page = form.dataset.page;
			const index = parseInt(form.dataset.index || '0', 10);
			const formData = new FormData(form);
			const obj = {};
			// collect simple fields first
			for (const [k, v] of formData.entries()) {
				if (v instanceof File) continue;
				obj[k] = v;
			}

			const fileInputs = Array.from(form.querySelectorAll('input[type=file]'));
			if (fileInputs.length === 0) {
				try { saveFormData(page, index, obj); } catch (err) { console.error('Save failed', err); }
				showSavedMessage(form);
				return;
			}

			const readers = fileInputs.map(fi => new Promise(resolve => {
				const f = fi.files[0];
				if (!f) return resolve({name: fi.name, value: null});
				const reader = new FileReader();
				reader.onload = e => resolve({name: fi.name, value: e.target.result});
				reader.onerror = () => resolve({name: fi.name, value: null});
				reader.readAsDataURL(f);
			}));

			Promise.all(readers).then(results => {
				results.forEach(r => { if (r && r.name) obj[r.name] = r.value; });
				try {
					saveFormData(page, index, obj);
				} catch (err) {
					console.error('Save failed', err);
					// strip out large images and try again
					for (const k of Object.keys(obj)) {
						if (typeof obj[k] === 'string' && obj[k].startsWith('data:image/')) delete obj[k];
					}
					try { saveFormData(page, index, obj); } catch (err2) { console.error('Save still failed', err2); }
				}
				showSavedMessage(form);
			});
		});
	});
}

function showSavedMessage(form) {
	const msg = document.createElement('div');
	msg.textContent = 'Saved locally. Open the target page to view changes.';
	msg.style.color = 'white';
	msg.style.background = 'green';
	msg.style.padding = '6px';
	msg.style.marginTop = '6px';
	form.appendChild(msg);
	setTimeout(() => msg.remove(), 3000);
}

// Create a new form DOM for a given type ('projects' or 'members') and optional data
function createFormElement(type, index, data = {}) {
	// ensure data is an object (caller may pass null)
	data = data || {};
	const wrapper = document.createElement('div');
	wrapper.innerHTML = type === 'projects' ? `
		<form class="edit-form" data-page="projects" data-index="${index}">
			<button type="button" class="remove-entry" style="float:left; margin-right:8px;">Remove</button>
			<label>Title:</label>
			<input type="text" name="title" value="${escapeHtml(data.title || '')}">
			<input type="file" name="image" accept="image/*">
			<br>
			<img style="max-height:120px; display:${data.image ? 'block' : 'none'}; margin-top:6px;" src="${data.image || ''}" alt="project preview">
			<br>
			<label>Cost:</label>
			<input type="text" name="cost" value="${escapeHtml(data.cost || '')}">
			<label>Description:</label>
			<textarea name="description">${escapeHtml(data.description || '')}</textarea>
			<button type="submit">Save Changes</button>
		</form>
	` : `
		<form class="edit-form" data-page="members" data-index="${index}">
			<button type="button" class="remove-entry" style="float:left; margin-right:8px;">Remove</button>
			<label>Name:</label>
			<input type="text" name="name" value="${escapeHtml(data.name || '')}">
			<input type="file" name="image" accept="image/*">
			<br>
			<img style="max-height:120px; display:${data.image ? 'block' : 'none'}; margin-top:6px;" src="${data.image || ''}" alt="member preview">
			<br>
			<label>Role:</label>
			<input type="text" name="role" value="${escapeHtml(data.role || '')}">
			<label>Bio:</label>
			<textarea name="bio">${escapeHtml(data.bio || '')}</textarea>
			<button type="submit">Save Changes</button>
		</form>
	`;
	return wrapper.firstElementChild;
}

function escapeHtml(s) {
	return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function addForm(type, data) {
	const key = `page:${type}`;
	const arr = JSON.parse(localStorage.getItem(key) || '[]');
	const index = arr.length;
	arr.push(data || {});
	localStorage.setItem(key, JSON.stringify(arr));
	// Rebuild the forms from storage so indexes and handlers stay consistent
	rebuildFormsFromStorage();
	// show a small visible confirmation so the user knows the add worked
	showTempMessage(`${type === 'projects' ? 'Project' : 'Member'} added`);
}

function showTempMessage(text) {
	const root = document.getElementById('forms-root') || document.body;
	const msg = document.createElement('div');
	msg.textContent = text;
	msg.style.position = 'fixed';
	msg.style.top = '12px';
	msg.style.right = '12px';
	msg.style.background = 'rgba(0,128,0,0.9)';
	msg.style.color = 'white';
	msg.style.padding = '8px 12px';
	msg.style.borderRadius = '4px';
	msg.style.zIndex = 9999;
	document.body.appendChild(msg);
	setTimeout(() => msg.remove(), 2000);
}

function removeFormAt(type, idx) {
	const key = `page:${type}`;
	const arr = JSON.parse(localStorage.getItem(key) || '[]');
	arr.splice(idx, 1);
	localStorage.setItem(key, JSON.stringify(arr));
}

function reindexForms() {
	// update data-index attributes for all forms so they match array order
	document.querySelectorAll('.edit-form').forEach((f, i) => {
		f.dataset.index = String(i);
	});
}

function attachRemoveHandlers() {
	document.querySelectorAll('.remove-entry').forEach(btn => {
		btn.removeEventListener('click', removeEntryClick);
		btn.addEventListener('click', removeEntryClick);
	});
}

function removeEntryClick(e) {
	const btn = e.currentTarget;
	const form = btn.closest('.edit-form');
	if (!form) return;
	const page = form.dataset.page;
	const idx = parseInt(form.dataset.index || '0', 10);
	// remove from storage
	removeFormAt(page, idx);
	// remove DOM
	form.remove();
	// reindex remaining forms and update stored array order
	reindexForms();
	// re-render forms-root so data-index matches storage
	// (we will reload from storage and rebuild forms)
	rebuildFormsFromStorage();
}

function rebuildFormsFromStorage() {
	const formsRoot = document.getElementById('forms-root');
	if (!formsRoot) return;
	// collect current pages we support
	const pages = ['projects', 'members', 'finances'];
	// If storage is empty, attempt to seed it from any existing static forms present
	let anyStored = false;
	pages.forEach(page => {
		const arr = JSON.parse(localStorage.getItem(`page:${page}`) || '[]');
		if (arr && arr.length) anyStored = true;
	});

	if (!anyStored) {
		// look for existing .edit-form elements inside formsRoot and build storage arrays
		const existingForms = Array.from(formsRoot.querySelectorAll('.edit-form'));
		if (existingForms.length) {
			const buckets = { projects: [], members: [] };
			existingForms.forEach(f => {
				const page = f.dataset.page;
				const fd = new FormData(f);
				const obj = {};
				for (const [k, v] of fd.entries()) {
					if (v instanceof File) continue;
					obj[k] = v;
				}
				// try to capture existing image src if an <img> preview exists
				const img = f.querySelector('img');
				if (img && img.src) obj.image = img.src;
				if (page && (page === 'projects' || page === 'members')) buckets[page].push(obj);
			});
			// write to storage
			pages.forEach(page => localStorage.setItem(`page:${page}`, JSON.stringify(buckets[page] || [])));
		}
	}

	// clear formsRoot and recreate from storage as three columns (projects, members, finances)
	formsRoot.innerHTML = '';
	// create section containers with headings to match the original three-column layout
	const sections = {};
	pages.forEach(page => {
		const sec = document.createElement('div');
		sec.className = 'edit-section';
		sec.dataset.page = page;
		const h2 = document.createElement('h2');
		h2.textContent = page === 'projects' ? 'Edit Projects Page' : page === 'members' ? 'Edit Members Page' : 'Edit Finances Page';
		sec.appendChild(h2);
		formsRoot.appendChild(sec);
		sections[page] = sec;
	});

	// populate each section from storage
	pages.forEach(page => {
		const arr = JSON.parse(localStorage.getItem(`page:${page}`) || '[]') || [];
		arr.forEach((item, i) => {
			const formEl = createFormElement(page, i, item);
			sections[page].appendChild(formEl);
		});
	});
	// reattach hooks
	setupEditForms();
	attachRemoveHandlers();
}

// Wire Add buttons (if present)
function setupAddButtons() {
	const addProject = document.getElementById('add-project');
	const addMember = document.getElementById('add-member');
	if (addProject) {
		addProject.onclick = () => { console.log('Add Project clicked'); addForm('projects', {}); };
	}
	if (addMember) {
		addMember.onclick = () => { console.log('Add Member clicked'); addForm('members', {}); };
	}
}

// Render helper for pages. Each page should include this script and then call renderPageData()
function renderPageData() {
	const path = location.pathname.split('/').pop();
	if (path === '' || path === 'index.html') return; // nothing to render on index
	if (path === 'projects.html') {
		// if storage is empty, seed it from current DOM so pages reflect the existing entries
	let data = getPageData('projects') || [];
	if (data.length === 0) {
			const existing = Array.from(document.querySelectorAll('.project'));
			data = existing.map(el => {
				const title = el.querySelector('h2') ? el.querySelector('h2').textContent.trim() : '';
				const img = el.querySelector('img') ? el.querySelector('img').src : '';
				const div = el.querySelector('div') ? el.querySelector('div').innerHTML.trim() : '';
				// try to extract cost from div text if present (simple)
				let cost = '';
				const costMatch = div.match(/Cost:\s*([^<\n]+)/i);
				if (costMatch) cost = costMatch[1].trim();
				return { title, image: img, description: div, cost };
			});
			localStorage.setItem('page:projects', JSON.stringify(data));
		}
		const main = document.querySelector('main');
		if (!main) return;
		main.innerHTML = '';
		data.forEach(p => {
			const div = document.createElement('div');
			div.className = 'project';
			div.innerHTML = `
				<h2>${escapeHtml(p.title || '')}</h2>
				${p.image ? `<img src="${p.image}" alt="${escapeHtml(p.title || '')}">` : ''}
				<div>${p.description || ''}${p.cost ? `<br>Cost: ${escapeHtml(p.cost)}` : ''}</div>
			`;
			main.appendChild(div);
		});
	}
	if (path === 'member.html') {
		// render all members from storage; seed from DOM if storage empty
	let data = getPageData('members') || [];
	if (data.length === 0) {
			const existing = Array.from(document.querySelectorAll('.member'));
			data = existing.map(el => {
				const img = el.querySelector('img') ? el.querySelector('img').src : '';
				const name = el.querySelector('h3') ? el.querySelector('h3').textContent.trim() : '';
				const paras = el.querySelectorAll('p');
				const role = paras[0] ? paras[0].textContent.replace(/^Role:\s*/i, '').trim() : '';
				const teams = paras[1] ? paras[1].textContent.replace(/^Teams:\s*/i, '').trim() : '';
				const bio = paras[2] ? paras[2].textContent.replace(/^Bio:\s*/i, '').trim() : '';
				return { image: img, name, role, teams, bio };
			});
			localStorage.setItem('page:members', JSON.stringify(data));
		}
		const main = document.querySelector('main');
		if (!main) return;
		main.innerHTML = '<div class="member-container"></div>';
		const container = main.querySelector('.member-container');
		data.forEach(m => {
			const el = document.createElement('div');
			el.className = 'member';
			el.innerHTML = `
				${m.image ? `<img src="${m.image}" alt="${escapeHtml(m.name || '')}">` : ''}
				<h3>${escapeHtml(m.name || '')}</h3>
				<p>Role: ${escapeHtml(m.role || '')}</p>
				<p>Teams: ${escapeHtml(m.teams || '')}</p>
				<p>Bio: ${escapeHtml(m.bio || '')}</p>
			`;
			container.appendChild(el);
		});
	}
	if (path === 'finances.html') {
	const data = getPageData('finances') || [];
	if (data.length === 0) return;
		const obj = data[0];
		if (!obj) return;
		// Replace main content with budget/expenses
		const main = document.querySelector('main');
		if (!main) return;
		main.innerHTML = `<div class="finance-summary"><h2>Budget</h2><p>${obj.budget || ''}</p><h3>Expenses</h3><p>${obj.expenses || ''}</p></div>`;
	}
}

// Auto-init when loaded on edit page
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', () => {
		// Rebuild forms from storage so edit page reflects saved entries
		rebuildFormsFromStorage();
		setupAddButtons();
		setupEditForms();
		attachRemoveHandlers();
		renderPageData();
	});
} else {
	rebuildFormsFromStorage();
	setupAddButtons();
	setupEditForms();
	attachRemoveHandlers();
	// run rendering for display pages
	renderPageData();
}

