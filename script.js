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
		form.addEventListener('submit', e => {
			e.preventDefault();
			const page = form.dataset.page;
			const index = parseInt(form.dataset.index || '0', 10);
			const formData = new FormData(form);
			const obj = {};
			for (const [k, v] of formData.entries()) obj[k] = v;
			saveFormData(page, index, obj);
			// feedback
			const msg = document.createElement('div');
			msg.textContent = 'Saved locally. Open the target page to view changes.';
			msg.style.color = 'white';
			msg.style.background = 'green';
			msg.style.padding = '6px';
			msg.style.marginTop = '6px';
			form.appendChild(msg);
			setTimeout(() => msg.remove(), 3000);
		});
	});
}

// Render helper for pages. Each page should include this script and then call renderPageData()
function renderPageData() {
	const path = location.pathname.split('/').pop();
	if (path === '' || path === 'index.html') return; // nothing to render on index
	if (path === 'projects.html') {
		const data = getPageData('projects');
		if (!data || data.length === 0) return;
		// find first project that exists -- we're using index 2 (Augmented Reality Cart) in editor
		const targetIndex = 2;
		const project = data[targetIndex];
		if (!project) return;
		// find the project block with matching title (best-effort) or replace the 3rd .project
		const projects = document.querySelectorAll('.project');
		const el = projects[targetIndex] || projects[2];
		if (!el) return;
		const titleEl = el.querySelector('h2');
		const divEl = el.querySelector('div');
		if (project.title) titleEl.textContent = project.title;
		if (project.description) divEl.innerHTML = project.description + (project.cost ? `<br>Cost: ${project.cost}` : '');
	}
	if (path === 'member.html' || path === 'member.html') {
		const data = getPageData('members');
		if (!data || data.length === 0) return;
		const memberEls = document.querySelectorAll('.member');
		data.forEach((m, i) => {
			const el = memberEls[i];
			if (!el) return;
			const nameEl = el.querySelector('h3');
			const paras = el.querySelectorAll('p');
			if (m.name) nameEl.textContent = m.name;
			if (m.role) paras[0].textContent = `Role: ${m.role}`;
			if (m.teams) paras[1] && (paras[1].textContent = `Teams: ${m.teams}`);
			if (m.bio) paras[2] && (paras[2].textContent = `Bio: ${m.bio}`);
		});
	}
	if (path === 'finances.html') {
		const data = getPageData('finances');
		if (!data || data.length === 0) return;
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
		setupEditForms();
		renderPageData();
	});
} else {
	setupEditForms();
	// run rendering for display pages
	renderPageData();
}

