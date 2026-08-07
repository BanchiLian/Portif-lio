    // =============================================================
    // CONFIGURACAO
    // =============================================================

    const HERO_SECTION_ID = 'inicio';

    // =============================================================
    // HELPERS DE DOM
    // =============================================================

    function getElement(id) {
      return document.getElementById(id);
    }

    function getAll(selector) {
      return document.querySelectorAll(selector);
    }

    // =============================================================
    // MODULO: NAVEGACAO
    // =============================================================

    function navigateTo(sectionId) {
      if (!getElement(`section-${sectionId}`)) return;

      deactivateAllNavButtons();
      deactivateAllSections();

      activateNavButton(sectionId);
      activateSection(sectionId);
      history.replaceState(null, '', `#${sectionId}`);
    }

    function deactivateAllNavButtons() {
      getAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.removeAttribute('aria-current');
      });
    }

    function deactivateAllSections() {
      getAll('.content-section').forEach(section => {
        section.classList.remove('active');
      });
    }

    function activateNavButton(sectionId) {
      const button = document.querySelector(`.nav-btn[data-section="${sectionId}"]`);
      if (button) {
        button.classList.add('active');
        button.setAttribute('aria-current', 'page');
      }
    }

    function activateSection(sectionId) {
      const section = getElement(`section-${sectionId}`);
      if (!section) return;

      section.classList.add('active');
    }

    function bindNavButtons() {
      getAll('.nav-btn').forEach(button => {
        button.addEventListener('click', () => {
          const sectionId = button.dataset.section;
          navigateTo(sectionId);
          scrollToTop();

          if (isMobileViewport()) {
            closeMobileSidebar();
          }
        });
      });
    }

    // =============================================================
    // MODULO: SIDEBAR / MENU
    // =============================================================

    const sidebar    = getElement('sidebar');
    const mainContent = getElement('main-content');

    function toggleDesktopMenu() {
      sidebar.classList.toggle('collapsed');
      mainContent.classList.toggle('expanded');
    }

    function toggleMobileMenu() {
      sidebar.classList.toggle('open');
    }

    function closeMobileSidebar() {
      sidebar.classList.remove('open');
    }

    function isMobileViewport() {
      return window.innerWidth <= 768;
    }

    function bindToggleMenu() {
      getElement('btn-toggle-menu').addEventListener('click', () => {
        if (isMobileViewport()) {
          toggleMobileMenu();
        } else {
          toggleDesktopMenu();
        }
      });
    }

    // =============================================================
    // MODULO: TEMA (DARK / LIGHT)
    // =============================================================

    const THEME_STORAGE_KEY = 'preferred-theme';
    const DARK_CLASS        = 'dark-mode';

    const THEME_LABELS = {
      dark:  { icon: '☀️', label: 'Modo Claro' },
      light: { icon: '🌙', label: 'Modo Escuro' }
    };

    function applyTheme(isDark) {
      document.body.classList.toggle(DARK_CLASS, isDark);
      updateThemeButton(isDark);
    }

    function updateThemeButton(isDark) {
      const config = isDark ? THEME_LABELS.dark : THEME_LABELS.light;
      getElement('theme-icon').textContent = config.icon;
      getElement('theme-label').textContent = config.label;
    }

    function toggleTheme() {
      const isDark = document.body.classList.toggle(DARK_CLASS);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
      } catch (error) {
        console.warn('Não foi possível salvar a preferência de tema.', error);
      }
      updateThemeButton(isDark);
    }

    function loadSavedTheme() {
      try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyTheme(saved ? saved === 'dark' : prefersDark);
      } catch {
        applyTheme(false);
      }
    }

    function bindThemeButton() {
      getElement('btn-theme').addEventListener('click', toggleTheme);
    }

    // =============================================================
    // MODULO: UTILITARIOS
    // =============================================================

    function scrollToTop() {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    }

    function bindContactForm() {
      getElement('contact-form').addEventListener('submit', event => {
        event.preventDefault();
        const name = getElement('contact-name').value.trim();
        const email = getElement('contact-email').value.trim();
        const message = getElement('contact-message').value.trim();
        const text = `Olá, Elian! Meu nome é ${name}.\n\n${message}\n\nContato: ${email}`;
        window.open(
          `https://wa.me/5519999324368?text=${encodeURIComponent(text)}`,
          '_blank',
          'noopener,noreferrer'
        );
      });
    }

    // =============================================================
    // INICIALIZACAO
    // =============================================================

    (function init() {
      loadSavedTheme();
      bindNavButtons();
      bindToggleMenu();
      bindThemeButton();
      bindContactForm();

      const initialSection = window.location.hash.slice(1) || HERO_SECTION_ID;
      navigateTo(initialSection);
    })();
