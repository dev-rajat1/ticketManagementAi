document.addEventListener('DOMContentLoaded', () => {
    // We use a small delay to ensure dynamic selects are loaded
    setTimeout(() => {
        window.initCustomSelects();
    }, 200);
});

window.initCustomSelects = function() {
    const selects = document.querySelectorAll('select.input-nm, .filter-item select, .form-group select, .form-group-row select');
    
    selects.forEach(select => {
        // Skip if already initialized
        if (select.nextElementSibling && select.nextElementSibling.classList.contains('nm-select-wrapper')) {
            // If it's already there, maybe we need to sync options. For simplicity, we just rebuild it.
            select.nextElementSibling.remove();
        }

        // Hide original select
        select.style.display = 'none';

        // Build wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'nm-select-wrapper';
        if (select.classList.contains('input-nm')) {
            wrapper.classList.add('is-input-nm');
        }

        // Build Display
        const display = document.createElement('div');
        display.className = 'nm-select-display input-nm'; // Inherit input-nm styling
        
        // Find selected option
        const selectedOption = select.options[select.selectedIndex];
        display.innerHTML = `<span>${selectedOption ? selectedOption.text : ''}</span><i class="fas fa-chevron-down"></i>`;
        
        // Build Options Panel
        const optionsPanel = document.createElement('ul');
        optionsPanel.className = 'nm-select-options';
        optionsPanel.style.display = 'none';

        Array.from(select.options).forEach((opt, index) => {
            const li = document.createElement('li');
            li.className = 'nm-select-option';
            li.textContent = opt.text;
            li.dataset.value = opt.value;
            if (index === select.selectedIndex) li.classList.add('selected');

            li.addEventListener('click', (e) => {
                e.stopPropagation();
                // Update native select
                select.value = opt.value;
                // Dispatch change event so React/Vanilla listeners catch it
                select.dispatchEvent(new Event('change', { bubbles: true }));
                
                // Update display
                display.querySelector('span').textContent = opt.text;
                
                // Update selected class
                optionsPanel.querySelectorAll('.nm-select-option').forEach(el => el.classList.remove('selected'));
                li.classList.add('selected');

                // Close panel
                optionsPanel.style.display = 'none';
                display.classList.remove('open');
            });

            optionsPanel.appendChild(li);
        });

        // Toggle panel
        display.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = optionsPanel.style.display === 'block';
            
            // Close all other panels first
            document.querySelectorAll('.nm-select-options').forEach(p => p.style.display = 'none');
            document.querySelectorAll('.nm-select-display').forEach(d => d.classList.remove('open'));

            if (!isOpen) {
                optionsPanel.style.display = 'block';
                display.classList.add('open');
            }
        });

        wrapper.appendChild(display);
        wrapper.appendChild(optionsPanel);
        
        // Insert after select
        select.parentNode.insertBefore(wrapper, select.nextSibling);
    });
};

// Close on outside click
document.addEventListener('click', () => {
    document.querySelectorAll('.nm-select-options').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.nm-select-display').forEach(d => d.classList.remove('open'));
});

// A Mutation Observer to detect when a select's children (options) change dynamically
const observer = new MutationObserver((mutations) => {
    let shouldReinit = false;
    mutations.forEach(m => {
        if (m.target.tagName === 'SELECT' && m.type === 'childList') {
            shouldReinit = true;
        }
    });
    if (shouldReinit) {
        window.initCustomSelects();
    }
});

// Start observing all selects
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        document.querySelectorAll('select').forEach(s => {
            observer.observe(s, { childList: true });
        });
    }, 500);
});
