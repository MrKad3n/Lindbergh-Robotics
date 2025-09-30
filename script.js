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
	data = data || {};
	const wrapper = document.createElement('div');

	if (type === 'projects') {
		wrapper.innerHTML = `
		<form class="edit-form" data-page="projects" data-index="${index}">
			<button type="button" class="remove-entry" style="float:left; margin-right:8px;">Remove</button>
			<label for="proj-${index}-title">Title:</label>
			<input id="proj-${index}-title" type="text" name="title" autocomplete="off" value="${escapeHtml(data.title || '')}">
			<input id="proj-${index}-image" type="file" name="image" accept="image/*">
			<br>
			<img id="proj-${index}-preview" style="max-height:120px; display:${data.image ? 'block' : 'none'}; margin-top:6px;" src="${data.image || ''}" alt="project preview">
			<br>
			<label for="proj-${index}-cost">Cost:</label>
			<input id="proj-${index}-cost" type="text" name="cost" autocomplete="off" value="${escapeHtml(data.cost || '')}">
			<label for="proj-${index}-description">Description:</label>
			<textarea id="proj-${index}-description" name="description">${escapeHtml(data.description || '')}</textarea>
			<button type="submit">Save Changes</button>
		</form>
	`;
	} else if (type === 'members') {
		wrapper.innerHTML = `
		<form class="edit-form" data-page="members" data-index="${index}">
			<button type="button" class="remove-entry" style="float:left; margin-right:8px;">Remove</button>
			<label for="mem-${index}-name">Name:</label>
			<input id="mem-${index}-name" type="text" name="name" autocomplete="name" value="${escapeHtml(data.name || '')}">
			<input id="mem-${index}-image" type="file" name="image" accept="image/*">
			<br>
			<img id="mem-${index}-preview" style="max-height:120px; display:${data.image ? 'block' : 'none'}; margin-top:6px;" src="${data.image || ''}" alt="member preview">
			<br>
			<label for="mem-${index}-role">Role:</label>
			<input id="mem-${index}-role" type="text" name="role" autocomplete="off" value="${escapeHtml(data.role || '')}">
			<label for="mem-${index}-bio">Bio:</label>
			<textarea id="mem-${index}-bio" name="bio">${escapeHtml(data.bio || '')}</textarea>
			<button type="submit">Save Changes</button>
		</form>
	`;
	} else if (type === 'finances') {
		wrapper.innerHTML = `
		<form class="edit-form" data-page="finances" data-index="${index}">
			<label for="budget">Current Budget:</label>
			<input autocomplete="off" type="text" id="budget" name="budget" value="${escapeHtml(data.budget || '')}">
			<label for="totalExpenses">Total Expenses:</label>
			<input autocomplete="off" type="text" id="totalExpenses" name="totalExpenses" value="${escapeHtml(data.totalExpenses || '')}">
			<label for="remaining">Remaining Budget:</label>
			<input autocomplete="off" type="text" id="remaining" name="remaining" value="${escapeHtml(data.remaining || '')}">
			<hr>
			<h3>Cost Breakdown (pie chart)</h3>
			<div class="chart-slices">
				<div>
					<label for="slice1-label">Slice 1 Label:</label>
					<input autocomplete="off" type="text" id="slice1-label" name="slice1Label" value="${escapeHtml(data.slice1Label || 'FTC')}">
					<label for="slice1-value">Slice 1 Value:</label>
					<input autocomplete="off" type="number" id="slice1-value" name="slice1Value" value="${escapeHtml(data.slice1Value || 0)}">
				</div>
				<div>
					<label for="slice2-label">Slice 2 Label:</label>
					<input autocomplete="off" type="text" id="slice2-label" name="slice2Label" value="${escapeHtml(data.slice2Label || 'Outreach')}">
					<label for="slice2-value">Slice 2 Value:</label>
					<input autocomplete="off" type="number" id="slice2-value" name="slice2Value" value="${escapeHtml(data.slice2Value || 0)}">
				</div>
				<div>
					<label for="slice3-label">Slice 3 Label:</label>
					<input autocomplete="off" type="text" id="slice3-label" name="slice3Label" value="${escapeHtml(data.slice3Label || 'go kart game')}">
					<label for="slice3-value">Slice 3 Value:</label>
					<input autocomplete="off" type="number" id="slice3-value" name="slice3Value" value="${escapeHtml(data.slice3Value || 0)}">
				</div>
			</div>
			<hr>
			<h3>Budget Coverage</h3>
			<label for="covered-value">Covered Amount:</label>
			<input autocomplete="off" type="number" id="covered-value" name="coveredValue" value="${escapeHtml(data.coveredValue || 0)}">
			<label for="coverage-remaining">Remaining Amount:</label>
			<input autocomplete="off" type="number" id="coverage-remaining" name="coverageRemaining" value="${escapeHtml(data.coverageRemaining || 0)}">
			<hr>
			<h3>Finance Project: First Tech Challenge</h3>
			<label for="ftc-title">Title:</label>
			<input autocomplete="off" type="text" id="ftc-title" name="ftcTitle" value="${escapeHtml(data.ftcTitle || '')}">
			<label for="ftc-image">Image (file):</label>
			<input id="ftc-image" type="file" name="ftcImage" accept="image/*">
			<br>
			<img id="ftc-image-preview" style="max-height:120px; display:${data.ftcImageData ? 'block' : 'none'}; margin-top:6px;" src="${data.ftcImageData || ''}" alt="FTC preview">
			<label for="ftc-progress">Progress % (display text inside bar):</label>
			<input autocomplete="off" type="number" id="ftc-progress" name="ftcProgress" value="${escapeHtml(data.ftcProgress || 0)}" min="0" max="100">
			<label for="ftc-details">Details text (dropdown content):</label>
			<textarea id="ftc-details" name="ftcDetails">${escapeHtml(data.ftcDetails || '')}</textarea>
			<hr>
			<h3>Footer / Contact</h3>
			<label for="donate-contact">Donate/Sponsor contact (email):</label>
			<input autocomplete="email" type="email" id="donate-contact" name="donateContact" value="${escapeHtml(data.donateContact || '')}">
			<label for="insta-link">Instagram URL:</label>
			<input autocomplete="url" type="text" id="insta-link" name="instagramUrl" value="${escapeHtml(data.instagramUrl || '')}">
			<hr>
			<div id="additional-finance-items">
			  <!-- dynamic additional finance rows will be rendered here -->
			</div>
			<button type="submit">Save Changes</button>
		</form>
	`;
	} else {
		// fallback: create a basic member form
		wrapper.innerHTML = `
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
	}
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
			const buckets = { projects: [], members: [], finances: [] };
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
				if (page && (page === 'projects' || page === 'members' || page === 'finances')) buckets[page].push(obj);
			});
			// write to storage
			pages.forEach(page => localStorage.setItem(`page:${page}`, JSON.stringify(buckets[page] || [])));
		}
	}

	// clear formsRoot and recreate from storage as columns (projects, members, finances)
	formsRoot.innerHTML = '';
	// create section containers with headings to match the original layout
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

	// initialize the finances editor (if present)
	if (typeof initFinancesEditor === 'function') {
		try { initFinancesEditor(); } catch (e) { console.warn('initFinancesEditor failed', e); }
	}
}

// Initialize the finances editor UI and behavior. This runs after forms are rebuilt so
// DOM references are stable. It manages additional finance items and saves to localStorage under 'finances_data'.
function initFinancesEditor() {
		var form = document.querySelector('.edit-form[data-page="finances"]');
		if (!form) return;

	console.log('initFinancesEditor: form found', !!form);

		var additionalRoot = form.querySelector('#additional-finance-items') || form.querySelector('#additional-finance-items');
		// fallback: ensure there's a container inside the form
		if (!additionalRoot) {
				additionalRoot = document.createElement('div');
				additionalRoot.id = 'additional-finance-items';
				form.appendChild(additionalRoot);
		}

			function renderAdditional(items){
				console.log('renderAdditional called, items length=', (items||[]).length);
				additionalRoot.innerHTML = '';
			(items || []).forEach(function(it, idx){
				var row = document.createElement('div');
				row.className = 'finance-item-row';
				row.innerHTML = '<input type="text" class="fin-label" placeholder="Label" value="'+(it.label||'')+'"> '
					+ '<input type="number" class="fin-value" placeholder="Value" value="'+(it.value||0)+'"> '
					+ '<button type="button" class="remove-finance">Remove</button>';
				additionalRoot.appendChild(row);
				row.querySelector('.remove-finance').addEventListener('click', function(){
					items.splice(idx,1); renderAdditional(items);
				});
			});
		}

		// load saved finances_data
		var saved = null;
		try { saved = JSON.parse(localStorage.getItem('finances_data') || 'null'); } catch(e){ saved = null; }
		var otherItems = (saved && saved.otherItems) ? saved.otherItems.slice() : [];
		renderAdditional(otherItems);

		function addFinanceItem(){ console.log('addFinanceItem triggered'); otherItems.push({ label: 'New Item', value: 0 }); renderAdditional(otherItems); }

		// wire local add button inside page (if present)
		var addFinanceBtn = document.getElementById('add-finance');
		if (addFinanceBtn) addFinanceBtn.addEventListener('click', addFinanceItem);
		// global event as fallback
		document.addEventListener('add-finance-clicked', addFinanceItem);

		// preview FT C image if present
		var ftcImageInput = form.querySelector('#ftc-image');
		var ftcPreview = form.querySelector('#ftc-image-preview');
		if (ftcImageInput && ftcPreview) {
			ftcImageInput.addEventListener('change', function(ev){
				var f = ev.target.files && ev.target.files[0];
				if (!f) return;
				var reader = new FileReader();
				reader.onload = function(e){ ftcPreview.src = e.target.result; ftcPreview.style.display = 'block'; };
				reader.readAsDataURL(f);
			});
		}

		// populate fields from saved
		if (saved) {
			try {
				['budget','totalExpenses','remaining','slice1Label','slice1Value','slice2Label','slice2Value','slice3Label','slice3Value','coveredValue','coverageRemaining','ftcTitle','ftcProgress','ftcDetails','donateContact','instagramUrl'].forEach(function(k){
					var el = form.querySelector('#'+k) || form.querySelector('[name="'+k+'"]');
					if (el && saved[k] !== undefined) el.value = saved[k];
				});
				if (saved.ftcImageData && ftcPreview) { ftcPreview.src = saved.ftcImageData; ftcPreview.style.display='block'; }
			} catch(e){ console.warn('populate finances failed', e); }
		}

		// handle submit to save finances_data
		form.addEventListener('submit', function(ev){
			ev.preventDefault();
			var data = {};
			try {
				['budget','totalExpenses','remaining','slice1Label','slice1Value','slice2Label','slice2Value','slice3Label','slice3Value','coveredValue','coverageRemaining','ftcTitle','ftcProgress','ftcDetails','donateContact','instagramUrl'].forEach(function(k){
					var el = form.querySelector('#'+k) || form.querySelector('[name="'+k+'"]');
					if (el) data[k] = el.value;
				});
			} catch(e){ console.warn('collect finances fields failed', e); }

			// include ftc image data if preview contains a data URL
			if (ftcPreview && ftcPreview.src && ftcPreview.src.indexOf('data:') === 0) data.ftcImageData = ftcPreview.src;

			// collect additional items from DOM
			try {
				var rows = additionalRoot.querySelectorAll('.finance-item-row');
				var items = [];
				rows.forEach(function(r){
					var label = (r.querySelector('.fin-label')||{}).value || '';
					var value = Number((r.querySelector('.fin-value')||{}).value) || 0;
					items.push({ label: label, value: value });
				});
				data.otherItems = items;
			} catch(e){ data.otherItems = otherItems || []; }

			try { localStorage.setItem('finances_data', JSON.stringify(data)); showTempMessage('Finances saved'); } catch(e){ console.error('save finances_data failed', e); alert('Save failed'); }
		});
}

// Wire Add buttons (if present)
function setupAddButtons() {
	const addProject = document.getElementById('add-project');
	const addMember = document.getElementById('add-member');
	const addFinance = document.getElementById('add-finance');
	if (addProject) {
		addProject.onclick = () => { console.log('Add Project clicked'); addForm('projects', {}); };
	}
	if (addMember) {
		addMember.onclick = () => { console.log('Add Member clicked'); addForm('members', {}); };
	}
	if (addFinance) {
		// dispatch an event so page-specific scripts can handle adding finance rows
		addFinance.addEventListener('click', function(){
			console.log('Add Finance clicked');
			document.dispatchEvent(new CustomEvent('add-finance-clicked'));
		});
	}
}

// Global fallback: if page-specific init didn't attach a handler, this will still add a visible row
document.addEventListener('add-finance-clicked', function fireFallbackAdd(e){
	try {
		var root = document.getElementById('additional-finance-items');
		var form = document.querySelector('.edit-form[data-page="finances"]');
		if (!root) {
			// try to find inside the finances form
			if (!form) {
				// try to create a finances form in the forms-root so users can edit immediately
				var formsRoot = document.getElementById('forms-root') || document.querySelector('.edit-container #forms-root');
				if (formsRoot) {
					// find or create a finances section
					var finSection = Array.from(formsRoot.children).find(function(c){ return c.dataset && c.dataset.page === 'finances'; });
					if (!finSection) {
						finSection = document.createElement('div');
						finSection.className = 'edit-section';
						finSection.dataset.page = 'finances';
						var h2 = document.createElement('h2'); h2.textContent = 'Edit Finances Page';
						finSection.appendChild(h2);
						formsRoot.appendChild(finSection);
					}
					// create a finances form element and append
					try {
						var newForm = createFormElement('finances', 0, {});
						finSection.appendChild(newForm);
						// attach handlers so the new form behaves like others
						setupEditForms(); attachRemoveHandlers();
						form = document.querySelector('.edit-form[data-page="finances"]');
					} catch(inner){ console.warn('failed to create finances form', inner); }
				}
			}
			if (form) root = form.querySelector('#additional-finance-items');
		}

		if (!root) {
			console.log('fallbackAdd: no additional-finance-items container found after attempted creation');
			return;
		}

		console.log('fallbackAdd: appending finance row to', root);
		var row = document.createElement('div');
		row.className = 'finance-item-row';
		row.innerHTML = '<input type="text" class="fin-label" placeholder="Label"> '
			+ '<input type="number" class="fin-value" placeholder="Value" value="0"> '
			+ '<button type="button" class="remove-finance">Remove</button>';
		root.appendChild(row);
		row.querySelector('.remove-finance').addEventListener('click', function(){ row.remove(); });
	} catch(err) { console.warn('fallbackAdd error', err); }
});

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

