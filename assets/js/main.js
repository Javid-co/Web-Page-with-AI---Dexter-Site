(function () {
  'use strict';

  const ready = (fn) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  };

  ready(() => {
    const page = document.body?.dataset?.page || '';
    const characters = Array.isArray(window.CHARACTERS) ? window.CHARACTERS : [];
    const villains = Array.isArray(window.VILLAINS) ? window.VILLAINS : [];

    const select = (selector, parent = document) => parent.querySelector(selector);
    const selectAll = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));

    const storage = {
      get(key, fallback) {
        try {
          const value = window.localStorage.getItem(key);
          return value ? JSON.parse(value) : fallback;
        } catch (error) {
          return fallback;
        }
      },
      set(key, value) {
        try {
          window.localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
          /* no-op */
        }
      }
    };

    const clampSummary = (text = '', limit = 168) => {
      if (text.length <= limit) return text;
      const trimmed = text.slice(0, limit);
      return `${trimmed.slice(0, trimmed.lastIndexOf(' '))}...`;
    };

    const highlightNav = () => {
      selectAll('[data-nav-link]').forEach((link) => {
        const linkPage = link.dataset.navLink;
        if (linkPage === page) {
          link.classList.add('nav__link--active');
          link.setAttribute('aria-current', 'page');
        } else {
          link.classList.remove('nav__link--active');
          link.removeAttribute('aria-current');
        }
      });
    };

    const initNavToggle = () => {
      const nav = select('[data-nav]');
      const toggle = select('[data-nav-toggle]');
      if (!nav || !toggle) return;

      toggle.addEventListener('click', () => {
        const isOpen = nav.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(isOpen));
      });

      selectAll('[data-nav-link]', nav).forEach((link) => {
        link.addEventListener('click', () => {
          nav.classList.remove('is-open');
          toggle.setAttribute('aria-expanded', 'false');
        });
      });
    };

    const getSeasonBadges = (seasons = []) =>
      seasons
        .sort((a, b) => a - b)
        .map((season) => `<span class="badge">Season ${season}</span>`)
        .join('');

    const createCardMarkup = (entity, options = {}) => {
      const { type = 'character', hideSpoilers = false } = options;
      const truncated = clampSummary(entity.summary, 165);
      const showSpoilerCover = hideSpoilers && entity.spoilerLevel === 'high';
      const badgeVillain = type === 'villain' ? '<span class="badge badge--villain">Villain</span>' : '';
      const summaryText = showSpoilerCover ? 'Spoiler hidden - toggle to view.' : truncated;

      return `
        <article class="card ${showSpoilerCover ? 'card--spoiler-hidden' : ''}" id="${entity.id}" data-entity-card>
          <div class="card__media">
            <img src="${entity.img}" alt="${entity.name}" width="400" height="300" loading="lazy" />
          </div>
          <div class="card__body">
            <div>
              <h3 class="card__title">${entity.name}</h3>
              <div class="badge-group">
                ${badgeVillain}
                ${getSeasonBadges(entity.seasons)}
              </div>
            </div>
            <p class="card__summary">${summaryText}</p>
            <div class="card__footer">
              <button class="card__button" type="button" data-detail-trigger="${entity.id}" data-entity-type="${type}">
                View details
              </button>
            </div>
          </div>
        </article>
      `;
    };

    const modal = select('[data-modal]');
    const modalTitle = modal ? select('[data-modal-title]', modal) : null;
    const modalSummary = modal ? select('[data-modal-summary]', modal) : null;
    const modalAliases = modal ? select('[data-modal-aliases]', modal) : null;
    const modalEpisodes = modal ? select('[data-modal-episodes]', modal) : null;
    const modalSeasons = modal ? select('[data-modal-seasons]', modal) : null;
    const modalType = modal ? select('[data-modal-type]', modal) : null;
    const modalClose = modal ? select('[data-modal-close]', modal) : null;

    let previouslyFocused = null;
    let focusableModalElements = [];

    const setModalLists = (listElement, items, emptyLabel) => {
      if (!listElement) return;
      if (!items || !items.length) {
        listElement.innerHTML = `<li>${emptyLabel}</li>`;
        return;
      }
      listElement.innerHTML = items
        .map((item) => `<li>${item}</li>`)
        .join('');
    };

    const trapFocus = (event) => {
      if (event.key === 'Escape') {
        closeModal();
        return;
      }

      if (event.key !== 'Tab' || focusableModalElements.length === 0) return;

      const first = focusableModalElements[0];
      const last = focusableModalElements[focusableModalElements.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const openModal = (entity, typeLabel) => {
      if (!modal || !modalTitle || !modalSummary) return;
      previouslyFocused = document.activeElement;

      modalTitle.textContent = entity.name;
      modalSummary.textContent = entity.summary;
      if (modalType) {
        modalType.textContent = typeLabel;
      }
      if (modalSeasons) {
        modalSeasons.textContent = entity.seasons
          .slice()
          .sort((a, b) => a - b)
          .map((season) => `Season ${season}`)
          .join(', ');
      }
      setModalLists(modalAliases, entity.aliases, 'No known aliases');
      setModalLists(modalEpisodes, entity.notableEpisodes, 'Episodes TBD');

      modal.classList.add('is-open');
      modal.removeAttribute('aria-hidden');

      focusableModalElements = selectAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        modal
      ).filter((node) => !node.hasAttribute('disabled'));

      document.addEventListener('keydown', trapFocus);

      (focusableModalElements[0] || modal).focus();
    };

    const closeModal = () => {
      if (!modal) return;
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.removeEventListener('keydown', trapFocus);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };

    if (modal && modalClose) {
      modalClose.addEventListener('click', closeModal);
    }

    if (modal) {
      modal.addEventListener('click', (event) => {
        if (event.target === modal) {
          closeModal();
        }
      });
    }

    const attachModalHandlers = (root, dataset) => {
      selectAll('[data-detail-trigger]', root).forEach((button) => {
        button.addEventListener('click', () => {
          const id = button.dataset.detailTrigger;
          const typeName = button.dataset.entityType || 'Profile';
          const record = dataset.find((item) => item.id === id);
          if (record) {
            openModal(record, typeName === 'villain' ? 'Villain Profile' : 'Character Profile');
          }
        });
      });
    };

    const initSpoilerBanner = () => {
      const banner = select('[data-spoiler-banner]');
      if (!banner) return;

      const dismissBtn = select('[data-spoiler-dismiss]', banner);
      const storageKey = banner.dataset.spoilerBannerKey;
      if (storageKey && storage.get(storageKey, false)) {
        banner.setAttribute('hidden', 'true');
        return;
      }

      if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
          banner.setAttribute('hidden', 'true');
          if (storageKey) {
            storage.set(storageKey, true);
          }
        });
      }
    };

    const renderCharacterGrid = () => {
      const grid = select('[data-character-grid]');
      if (!grid) return;

      const searchInput = select('[data-search]');
      const seasonCheckboxes = selectAll('[data-filter-season]');
      const state = {
        search: '',
        seasons: new Set()
      };

      const filterData = () => {
        const query = state.search.toLowerCase();
        const selectedSeasons = state.seasons;

        return characters.filter((character) => {
          const matchesSearch = !query || character.name.toLowerCase().includes(query);
          const matchesSeason = !selectedSeasons.size
            ? true
            : character.seasons.some((season) => selectedSeasons.has(String(season)));
          return matchesSearch && matchesSeason;
        });
      };

      const render = () => {
        const results = filterData();
        if (!results.length) {
          grid.innerHTML = '<div class="empty-state" role="status">No characters match your filters yet.</div>';
          return;
        }
        grid.innerHTML = results
          .map((item) => createCardMarkup(item, { type: 'character' }))
          .join('');
        attachModalHandlers(grid, characters);
      };

      if (searchInput) {
        searchInput.addEventListener('input', (event) => {
          state.search = event.target.value.trim();
          render();
        });
      }

      seasonCheckboxes.forEach((checkbox) => {
        checkbox.addEventListener('change', (event) => {
          const { value, checked } = event.target;
          if (checked) {
            state.seasons.add(value);
          } else {
            state.seasons.delete(value);
          }
          render();
        });
      });

      render();
    };

    const renderVillainGrid = () => {
      const grid = select('[data-villain-grid]');
      if (!grid) return;

      const searchInput = select('[data-search]');
      const seasonCheckboxes = selectAll('[data-filter-season]');
      const spoilerToggle = select('[data-spoiler-toggle]');
      const storageKey = 'dexterSpoilerToggleVillains';
      const state = {
        search: '',
        seasons: new Set(),
        hideSpoilers: storage.get(storageKey, true)
      };

      if (spoilerToggle) {
        spoilerToggle.checked = state.hideSpoilers;
        spoilerToggle.addEventListener('change', (event) => {
          state.hideSpoilers = event.target.checked;
          storage.set(storageKey, state.hideSpoilers);
          render();
        });
      }

      const filterData = () => {
        const query = state.search.toLowerCase();
        const selectedSeasons = state.seasons;

        return villains.filter((villain) => {
          const matchesSearch = !query || villain.name.toLowerCase().includes(query);
          const matchesSeason = !selectedSeasons.size
            ? true
            : villain.seasons.some((season) => selectedSeasons.has(String(season)));
          return matchesSearch && matchesSeason;
        });
      };

      const render = () => {
        const results = filterData();
        if (!results.length) {
          grid.innerHTML = '<div class="empty-state" role="status">No villains match your filters yet.</div>';
          return;
        }
        grid.innerHTML = results
          .map((item) => createCardMarkup(item, { type: 'villain', hideSpoilers: state.hideSpoilers }))
          .join('');
        attachModalHandlers(grid, villains);
      };

      if (searchInput) {
        searchInput.addEventListener('input', (event) => {
          state.search = event.target.value.trim();
          render();
        });
      }

      seasonCheckboxes.forEach((checkbox) => {
        checkbox.addEventListener('change', (event) => {
          const { value, checked } = event.target;
          if (checked) {
            state.seasons.add(value);
          } else {
            state.seasons.delete(value);
          }
          render();
        });
      });

      render();
    };

    const buildFeatured = () => {
      const container = select('[data-featured]');
      if (!container) return;

      const featuredCharacter = characters.find((item) => item.id === 'dexter-morgan') || characters[0];
      const featuredVillain = villains.find((item) => item.id === 'arthur-mitchell') || villains[0];

      const buildFeatureCard = (entity, label, targetPage) => `
        <article class="feature-card" tabindex="0">
          <div class="feature-card__img">
            <img src="${entity.img}" alt="${entity.name}" width="480" height="360" loading="lazy" />
            <span class="feature-card__badge">${label}</span>
          </div>
          <div>
            <h3>${entity.name}</h3>
            <p class="feature-card__summary">${clampSummary(entity.summary, 180)}</p>
            <a class="btn btn--ghost" href="${targetPage}#${entity.id}">
              Explore profile
            </a>
          </div>
        </article>
      `;

      const parts = [];
      if (featuredCharacter) {
        parts.push(buildFeatureCard(featuredCharacter, 'Featured Character', 'characters.html'));
      }
      if (featuredVillain) {
        parts.push(buildFeatureCard(featuredVillain, 'Featured Villain', 'villains.html'));
      }

      container.innerHTML = parts.join('');
    };

    const buildTimeline = () => {
      const container = select('[data-timeline]');
      if (!container) return;

      const storageKey = 'dexterSpoilerToggleTimeline';
      const spoilerToggle = select('[data-spoiler-toggle]');
      const state = {
        hideSpoilers: storage.get(storageKey, true)
      };

      if (spoilerToggle) {
        spoilerToggle.checked = state.hideSpoilers;
        spoilerToggle.addEventListener('change', (event) => {
          state.hideSpoilers = event.target.checked;
          storage.set(storageKey, state.hideSpoilers);
          render();
        });
      }

      const seasonsMap = new Map();
      const addToSeason = (entity, type) => {
        entity.seasons.forEach((season) => {
          if (!seasonsMap.has(season)) {
            seasonsMap.set(season, []);
          }
          seasonsMap.get(season).push({ ...entity, type });
        });
      };

      characters.forEach((item) => addToSeason(item, 'character'));
      villains.forEach((item) => addToSeason(item, 'villain'));

      const render = () => {
        const seasons = Array.from(seasonsMap.keys()).sort((a, b) => a - b);
        if (!seasons.length) {
          container.innerHTML = '<p class="empty-state">Timeline data coming soon.</p>';
          return;
        }

        container.innerHTML = seasons
          .map((season) => {
            const entries = seasonsMap.get(season)
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name));

            const items = entries
              .map((entry) => {
                const targetPage = entry.type === 'villain' ? 'villains.html' : 'characters.html';
                const summary = state.hideSpoilers && entry.spoilerLevel === 'high'
                  ? 'Spoiler hidden - toggle to view.'
                  : clampSummary(entry.summary, 220);
                return `
                  <li class="timeline__item">
                    <details>
                      <summary>${entry.name} <span class="sr-only">(${entry.type})</span></summary>
                      <p>${summary}</p>
                      <a href="${targetPage}#${entry.id}">Open ${entry.type} profile</a>
                    </details>
                  </li>
                `;
              })
              .join('');

            return `
              <section class="timeline__season" aria-labelledby="season-${season}">
                <h3 id="season-${season}" class="timeline__header">Season ${season}</h3>
                <ul class="timeline__list">
                  ${items}
                </ul>
              </section>
            `;
          })
          .join('');
      };

      render();
    };

    const initHome = () => {
      buildFeatured();
    };

    const initCharacters = () => {
      renderCharacterGrid();
    };

    const initVillains = () => {
      renderVillainGrid();
    };

    const initTimeline = () => {
      buildTimeline();
    };

    const initFooterYear = () => {
      const yearTarget = select('[data-current-year]');
      if (yearTarget) {
        yearTarget.textContent = new Date().getFullYear();
      }
    };

    highlightNav();
    initNavToggle();
    initSpoilerBanner();
    initFooterYear();

    switch (page) {
      case 'home':
        initHome();
        break;
      case 'characters':
        initCharacters();
        break;
      case 'villains':
        initVillains();
        break;
      case 'timeline':
        initTimeline();
        break;
      default:
        break;
    }
  });
})();
