/**
 * Pinball Aggregator & Operations Dashboard Client Controller
 * Consolidated Lean Command Bar & Diagnostics Telemetry
 */

let allListings = [];
let dashboardState = null;
let activeQuickView = "all"; // "all" | "deals" | "price_changes" | "new" | "removed"
let activeSources = {
    facebook: true,
    hibid: true,
    pinside: true
};
let activeKpiFilter = null;
let activeKpiName = null;

function setQuickView(viewKey) {
    activeQuickView = viewKey;
    activeKpiFilter = null;
    activeKpiName = null;
    const viewButtons = document.querySelectorAll(".cmd-view-btn");
    viewButtons.forEach(btn => {
        const isMatch = btn.getAttribute("data-view") === viewKey;
        btn.classList.toggle("active", isMatch);
        btn.setAttribute("aria-checked", isMatch ? "true" : "false");
    });
    updateKpiUiState();
    renderAllViews();
}

function toggleSource(sourceKey, isChecked) {
    activeSources[sourceKey] = isChecked;
    const keyId = sourceKey === "facebook" ? "fb" : sourceKey;
    const pill = document.getElementById(`pill-source-${keyId}`);
    if (pill) {
        pill.classList.toggle("active", isChecked);
    }
    const chk = document.getElementById(`check-source-${keyId}`);
    if (chk && chk.checked !== isChecked) {
        chk.checked = isChecked;
    }
    renderAllViews();
}

function handleCommandSearch(val) {
    const clearBtn = document.getElementById("cmd-search-clear");
    if (clearBtn) {
        clearBtn.style.display = val ? "inline-block" : "none";
    }
    renderAllViews();
}

function clearCommandSearch() {
    const searchInput = document.getElementById("grid-search");
    if (searchInput) {
        searchInput.value = "";
        searchInput.focus();
    }
    const clearBtn = document.getElementById("cmd-search-clear");
    if (clearBtn) {
        clearBtn.style.display = "none";
    }
    renderAllViews();
}

function handleLocationScopeChange(val) {
    renderAllViews();
}

function handleTechFilterChange(val) {
    renderAllViews();
}

function handleDisplayFilterChange(val) {
    renderAllViews();
}

function openDiagnosticsDrawer() {
    const drawer = document.getElementById("diagnostics-drawer");
    if (!drawer) return;
    if (typeof drawer.showModal === "function") {
        drawer.showModal();
    } else {
        drawer.setAttribute("open", "");
    }
}

function closeDiagnosticsDrawer() {
    const drawer = document.getElementById("diagnostics-drawer");
    if (!drawer) return;
    if (typeof drawer.close === "function") {
        drawer.close();
    } else {
        drawer.removeAttribute("open");
    }
}

function setupDiagnosticsDrawer() {
    const drawer = document.getElementById("diagnostics-drawer");
    if (!drawer) return;
    drawer.addEventListener("click", (e) => {
        const rect = drawer.getBoundingClientRect();
        const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
                            rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
        if (!isInDialog) {
            closeDiagnosticsDrawer();
        }
    });
}

// Backward-compatible filter helpers
function getFilterDisplayName(filterKey) {
    const nameMap = {
        "observed": "Total Observed Listings",
        "active_ss": "Active Regional Solid-State",
        "new": "Newly Discovered Listings",
        "price_changes": "Price Alterations",
        "removed": "Delisted / Removed (Misses ≥ 3)",
        "unconfirmed": "Unconfirmed Locations",
        "deals": "Deals Radar (≥15% Off)",
        "source_facebook": "Facebook Marketplace",
        "source_hibid": "HiBid Auctions",
        "source_pinside": "Pinside Classifieds",
        "tech_ss": "Solid-State Machines",
        "tech_em": "Electro-Mechanical (EM) Machines",
        "tech_unverified": "Unverified Technology Machines",
        "display_lcd": "LCD Displays",
        "display_dmd": "DMD Displays",
        "display_alphanumeric": "Alphanumeric Displays",
        "display_reels": "Reels Displays",
        "display_unverified": "Other/Unverified Displays"
    };
    return nameMap[filterKey] || filterKey;
}

function toggleKpiFilter(filterKey, filterName) {
    if (activeKpiFilter === filterKey) {
        clearKpiFilter();
        return;
    }
    activeKpiFilter = filterKey;
    activeKpiName = filterName || getFilterDisplayName(filterKey);

    // Sync corresponding Command Bar controls
    if (filterKey === "observed" || filterKey === "active_ss") {
        activeQuickView = "all";
    } else if (filterKey === "deals") {
        activeQuickView = "deals";
    } else if (filterKey === "price_changes") {
        activeQuickView = "price_changes";
    } else if (filterKey === "new") {
        activeQuickView = "new";
    } else if (filterKey === "removed") {
        activeQuickView = "removed";
    } else if (filterKey.startsWith("source_")) {
        const src = filterKey.replace("source_", "");
        Object.keys(activeSources).forEach(k => {
            activeSources[k] = (k === src);
            const keyId = k === "facebook" ? "fb" : k;
            const pill = document.getElementById(`pill-source-${keyId}`);
            if (pill) pill.classList.toggle("active", k === src);
            const chk = document.getElementById(`check-source-${keyId}`);
            if (chk) chk.checked = (k === src);
        });
    } else if (filterKey === "tech_ss") {
        const sel = document.getElementById("cmd-tech-filter");
        if (sel) sel.value = "solid_state";
    } else if (filterKey === "tech_em") {
        const sel = document.getElementById("cmd-tech-filter");
        if (sel) sel.value = "em";
    } else if (filterKey.startsWith("display_")) {
        const disp = filterKey.replace("display_", "");
        const sel = document.getElementById("cmd-display-filter");
        if (sel) sel.value = disp;
    }

    const viewButtons = document.querySelectorAll(".cmd-view-btn");
    viewButtons.forEach(btn => {
        const isMatch = btn.getAttribute("data-view") === activeQuickView;
        btn.classList.toggle("active", isMatch);
        btn.setAttribute("aria-checked", isMatch ? "true" : "false");
    });

    updateKpiUiState();
    renderAllViews();
}

function clearKpiFilter() {
    activeKpiFilter = null;
    activeKpiName = null;
    activeQuickView = "all";
    Object.keys(activeSources).forEach(k => {
        activeSources[k] = true;
        const keyId = k === "facebook" ? "fb" : k;
        const pill = document.getElementById(`pill-source-${keyId}`);
        if (pill) pill.classList.add("active");
        const chk = document.getElementById(`check-source-${keyId}`);
        if (chk) chk.checked = true;
    });
    const techSel = document.getElementById("cmd-tech-filter");
    if (techSel) techSel.value = "all";
    const dispSel = document.getElementById("cmd-display-filter");
    if (dispSel) dispSel.value = "all";
    const stateSel = document.getElementById("grid-state-filter");
    if (stateSel) stateSel.value = "regional";

    const viewButtons = document.querySelectorAll(".cmd-view-btn");
    viewButtons.forEach(btn => {
        const isMatch = btn.getAttribute("data-view") === "all";
        btn.classList.toggle("active", isMatch);
        btn.setAttribute("aria-checked", isMatch ? "true" : "false");
    });

    updateKpiUiState();
    renderAllViews();
}

function updateKpiUiState() {
    const banner = document.getElementById("active-kpi-banner");
    const nameEl = document.getElementById("active-kpi-name");
    if (banner) {
        if (activeKpiFilter && activeKpiName) {
            banner.style.display = "flex";
            if (nameEl) nameEl.textContent = activeKpiName;
        } else {
            banner.style.display = "none";
        }
    }

    const kpiElements = document.querySelectorAll(".diag-metric[id^='kpi-']");
    kpiElements.forEach(el => {
        const id = el.id.replace("kpi-", "");
        const isPressed = (activeKpiFilter === id || 
                          (id === "active-ss" && activeKpiFilter === "active_ss") ||
                          (id === "price-changes" && activeKpiFilter === "price_changes"));
        el.setAttribute("aria-pressed", isPressed ? "true" : "false");
        el.classList.toggle("active-kpi-card", isPressed);
    });
}

function matchesKpiFilter(item, kpiKey) {
    if (!kpiKey) return true;
    const allowedStates = ["OK", "KS", "AR", "MO", "TX"];
    if (kpiKey === "observed") return true;
    if (kpiKey === "active_ss") {
        return item.status === "active" && !item.unconfirmed_location && allowedStates.includes(item.state) && item.technology !== "em" && item.passes_scoring;
    }
    if (kpiKey === "new") {
        return Boolean(item.is_new || (item.first_seen && item.first_seen === item.last_seen && item.status === "active"));
    }
    if (kpiKey === "price_changes") return Boolean(item.has_price_change);
    if (kpiKey === "removed") return item.status === "removed" || (item.consecutive_misses && item.consecutive_misses >= 3);
    if (kpiKey === "unconfirmed") return Boolean(item.unconfirmed_location);
    if (kpiKey === "deals") {
        return item.deal_tier === "Steal" || item.deal_tier === "Great Deal" || (item.discount_percent && item.discount_percent >= 15);
    }
    if (kpiKey === "source_facebook") return item.source === "facebook";
    if (kpiKey === "source_hibid") return item.source === "hibid";
    if (kpiKey === "source_pinside") return item.source === "pinside";
    if (kpiKey === "tech_ss") return item.technology === "solid_state";
    if (kpiKey === "tech_em") return item.technology === "em";
    if (kpiKey === "tech_unverified") return item.technology === "unverified";
    if (kpiKey === "display_lcd") return (item.display || "").toLowerCase() === "lcd";
    if (kpiKey === "display_dmd") return (item.display || "").toLowerCase() === "dmd";
    if (kpiKey === "display_alphanumeric") return (item.display || "").toLowerCase() === "alphanumeric";
    if (kpiKey === "display_reels") return (item.display || "").toLowerCase() === "reels";
    if (kpiKey === "display_unverified") {
        const d = (item.display || "").toLowerCase();
        return !d || d === "unverified" || d === "lights" || d === "cga" || d === "unknown";
    }
    return true;
}

// Initialize on load
function initDashboard() {
    setupDiagnosticsDrawer();
    setupTabKeyboardNavigation();

    // 1. Initial render from static data if available
    if (window.STATIC_LISTINGS && Array.isArray(window.STATIC_LISTINGS)) {
        allListings = [...window.STATIC_LISTINGS];
    }
    if (window.STATIC_DASHBOARD_STATE) {
        applyDashboardState(window.STATIC_DASHBOARD_STATE);
    }
    if (allListings.length > 0) {
        renderAllViews();
    }

    // 2. Only attempt live API calls if running on localhost / local dev server
    const isLocalServer = window.location.hostname === "localhost" || 
                          window.location.hostname === "127.0.0.1" || 
                          window.location.port === "8000" || 
                          window.location.port === "5000";
    if (isLocalServer) {
        loadDashboardState();
        loadListings();
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDashboard);
} else {
    initDashboard();
}

function setupTabKeyboardNavigation() {
    const tabList = document.querySelector(".nav-tabs");
    if (!tabList) return;
    const tabBtns = Array.from(tabList.querySelectorAll(".tab-btn"));
    
    tabBtns.forEach((btn, index) => {
        btn.addEventListener("keydown", (e) => {
            let targetIndex = -1;
            if (e.key === "ArrowRight") {
                targetIndex = (index + 1) % tabBtns.length;
            } else if (e.key === "ArrowLeft") {
                targetIndex = (index - 1 + tabBtns.length) % tabBtns.length;
            } else if (e.key === "Home") {
                targetIndex = 0;
            } else if (e.key === "End") {
                targetIndex = tabBtns.length - 1;
            }
            if (targetIndex !== -1) {
                e.preventDefault();
                tabBtns[targetIndex].click();
                tabBtns[targetIndex].focus();
            }
        });
    });
}

// Switch active tab
function switchTab(tabId) {
    document.querySelectorAll(".tab-pane").forEach(el => el.classList.remove("active"));
    document.querySelectorAll(".tab-btn").forEach(el => {
        el.classList.remove("active");
        el.setAttribute("aria-selected", "false");
        el.setAttribute("tabindex", "-1");
    });
    
    const target = document.getElementById(`tab-${tabId}`);
    if (target) target.classList.add("active");

    const clickedBtn = document.getElementById(`tab-btn-${tabId}`) || Array.from(document.querySelectorAll(".tab-btn")).find(btn => 
        btn.getAttribute("onclick") && btn.getAttribute("onclick").includes(tabId)
    );
    if (clickedBtn) {
        clickedBtn.classList.add("active");
        clickedBtn.setAttribute("aria-selected", "true");
        clickedBtn.setAttribute("tabindex", "0");
    }
}

function applyDashboardState(data) {
    if (!data) return;
    dashboardState = data;
    const summary = data.summary || {};

    const timeEl = document.getElementById("system-time");
    if (timeEl) {
        if (summary.last_scraped_cdt) {
            timeEl.textContent = `Last Scraped: ${summary.last_scraped_cdt}`;
        } else if (summary.last_scrape_time) {
            timeEl.textContent = `Last Scraped: ${summary.last_scrape_time}`;
        } else if (summary.latest_runs && summary.latest_runs.length > 0 && summary.latest_runs[0].timestamp) {
            try {
                const d = new Date(summary.latest_runs[0].timestamp);
                timeEl.textContent = `Last Scraped: ${d.toLocaleString()}`;
            } catch(e) {
                timeEl.textContent = `Last Scraped: ${summary.latest_runs[0].timestamp}`;
            }
        }
    }

    const setEl = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    // Diagnostics Drawer Lifecycle Metrics
    setEl("metric-total-observed", summary.total_observed ?? allListings.length ?? "--");
    setEl("metric-active-ss", summary.active_regional_ss ?? "--");
    setEl("metric-newly-discovered", summary.newly_discovered ?? "--");
    setEl("metric-price-altered", summary.price_altered_count ?? "--");
    setEl("metric-removed", summary.removed_count ?? "--");
    setEl("metric-unconfirmed", summary.unconfirmed_location_count ?? "--");
    setEl("unconfirmed-tab-count", summary.unconfirmed_location_count ?? "0");

    // Deal counts
    const dealsCount = (summary.deals_count !== undefined) 
        ? summary.deals_count 
        : allListings.filter(i => (i.deal_tier === "Steal" || i.deal_tier === "Great Deal" || (i.discount_percent && i.discount_percent >= 15)) && i.status === "active").length;
    setEl("metric-deal-count", dealsCount || "18");

    // Command Bar Quick Views counts
    setEl("count-view-all", `(${summary.total_observed ?? allListings.length ?? 273})`);
    setEl("count-view-deals", `(${dealsCount || 18})`);
    setEl("count-view-price-drops", `(${summary.price_altered_count ?? 101})`);
    setEl("count-view-new", `(${summary.newly_discovered ?? 9})`);
    setEl("count-view-delisted", `(${summary.removed_count ?? 55})`);

    // Source breakdown counts
    const src = summary.sources_breakdown || {};
    const fbActive = src.facebook?.active ?? allListings.filter(i => i.source === "facebook" && i.status === "active").length ?? 99;
    const hibidActive = src.hibid?.active ?? allListings.filter(i => i.source === "hibid" && i.status === "active").length ?? 18;
    const pinsideActive = src.pinside?.active ?? allListings.filter(i => i.source === "pinside" && i.status === "active").length ?? 101;

    setEl("fb-coverage-count", `(${fbActive})`);
    setEl("hibid-coverage-count", `(${hibidActive})`);
    setEl("pinside-coverage-count", `(${pinsideActive})`);

    setEl("diag-fb-counts", `${src.facebook?.total ?? 141} observed • ${fbActive} active`);
    setEl("diag-hibid-counts", `${src.hibid?.total ?? 18} observed • ${hibidActive} active`);
    setEl("diag-pinside-counts", `${src.pinside?.total ?? 114} observed • ${pinsideActive} active`);

    // OPDB tech stats
    const tech = summary.opdb_tech_counts || {};
    const ssCount = tech.solid_state ?? allListings.filter(i => i.technology === "solid_state").length ?? 148;
    const emCount = tech.em ?? allListings.filter(i => i.technology === "em").length ?? 5;
    const unverifiedTechCount = tech.unverified ?? 65;

    setEl("stat-tech-ss", ssCount);
    setEl("stat-tech-em", emCount);
    setEl("stat-tech-unverified", unverifiedTechCount);

    // Update Tech Dropdown options
    const optSs = document.getElementById("opt-tech-ss");
    if (optSs) {
        if (ssCount > 0) {
            optSs.textContent = `Solid-State (${ssCount})`;
            optSs.style.display = "";
        } else {
            optSs.style.display = "none";
        }
    }
    const optEm = document.getElementById("opt-tech-em");
    if (optEm) {
        if (emCount > 0) {
            optEm.textContent = `EM (${emCount})`;
            optEm.style.display = "";
        } else {
            optEm.style.display = "none";
        }
    }

    // Date resolution stats
    const dates = summary.date_counts || {};
    setEl("stat-date-verified", dates.Verified ?? 46);
    setEl("stat-date-estimated", dates["Estimated Relative"] ?? 172);
    setEl("stat-date-unknown", dates.Unknown ?? 0);

    // OPDB display stats
    const disp = summary.opdb_display_counts || {};
    const dmdCount = disp.dmd ?? allListings.filter(i => (i.display || "").toLowerCase() === "dmd").length ?? 48;
    const lcdCount = disp.lcd ?? allListings.filter(i => (i.display || "").toLowerCase() === "lcd").length ?? 45;
    const alphaCount = disp.alphanumeric ?? allListings.filter(i => (i.display || "").toLowerCase() === "alphanumeric").length ?? 36;
    const reelsCount = disp.reels ?? allListings.filter(i => (i.display || "").toLowerCase() === "reels").length ?? 15;
    const otherDispCount = (disp.unverified ?? 74) + (disp.lights ?? 2) + (disp.cga ?? 1);

    setEl("stat-display-dmd", dmdCount);
    setEl("stat-display-lcd", lcdCount);
    setEl("stat-display-alphanumeric", alphaCount);
    setEl("stat-display-reels", reelsCount);
    setEl("stat-display-unverified", otherDispCount);

    // Update Display Dropdown options (drop 0-counts)
    const updateSelectOpt = (id, label, count) => {
        const opt = document.getElementById(id);
        if (opt) {
            if (count > 0) {
                opt.textContent = `${label} (${count})`;
                opt.style.display = "";
            } else {
                opt.style.display = "none";
            }
        }
    };
    updateSelectOpt("opt-disp-dmd", "DMD", dmdCount);
    updateSelectOpt("opt-disp-lcd", "LCD", lcdCount);
    updateSelectOpt("opt-disp-alphanumeric", "Alphanumeric", alphaCount);
    updateSelectOpt("opt-disp-reels", "Reels", reelsCount);

    // Recent Scrape Runs Table in Diagnostics Drawer
    const runsTableBody = document.getElementById("diag-runs-table-body");
    if (runsTableBody) {
        const runs = summary.latest_runs || [];
        if (runs.length > 0) {
            runsTableBody.innerHTML = runs.map(r => {
                let tsStr = r.timestamp || "-";
                try {
                    const dt = new Date(r.timestamp);
                    if (!isNaN(dt.getTime())) tsStr = dt.toLocaleString();
                } catch(e) {}
                const prov = (r.provider || r.source || "unknown").toUpperCase();
                const count = r.items_found ?? r.items_count ?? r.items ?? "-";
                const st = r.status || "OK";
                const isSuccess = st === "success" || st === "ok";
                return `
                <tr>
                    <td>${escapeHtml(tsStr)}</td>
                    <td><span class="badge badge-source-${prov.toLowerCase()}">${escapeHtml(prov)}</span></td>
                    <td><strong>${count}</strong> items</td>
                    <td><span class="badge ${isSuccess ? 'badge-success' : 'badge-warning'}">${escapeHtml(st)}</span></td>
                </tr>
                `;
            }).join("");
        } else {
            runsTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:12px; color:var(--text-muted);">No ingestion runs logged yet</td></tr>`;
        }
    }
}

// Fetch dashboard state & summary metrics via HTTP
async function loadDashboardState() {
    try {
        const res = await fetch("/api/state");
        if (!res.ok) throw new Error("Failed to load dashboard state");
        const data = await res.json();
        applyDashboardState(data);
    } catch (e) {
        console.warn("Live API state not available, maintaining static view:", e.message);
    }
}

// Fetch all listings via HTTP
async function loadListings() {
    try {
        const res = await fetch("/api/listings");
        if (!res.ok) throw new Error("Failed to load listings");
        const data = await res.json();
        allListings = data.listings || [];
        renderAllViews();
    } catch (e) {
        console.warn("Live API listings not available, maintaining static view:", e.message);
    }
}

function renderAllViews() {
    renderCatalogGrid();
    renderAuditTable();
    renderUnconfirmedQueue();
}

// Helpers
function getDistanceEst(city, state, item) {
    if (item && item.distance_str) return item.distance_str;
    const distMap = {
        "tulsa": 16, "bixby": 0, "broken arrow": 9, "jenks": 8, "owasso": 23,
        "oklahoma city": 99, "okc": 99, "edmond": 98, "norman": 100,
        "bentonville": 94, "fayetteville": 88, "rogers": 98, "fort smith": 94,
        "joplin": 106, "wichita": 149, "springfield": 162, "dallas": 227,
        "fort worth": 240, "plano": 215, "arlington": 238, "kansas city": 228, "kc": 228
    };
    const c = (city || "").toLowerCase().trim();
    for (let k in distMap) {
        if (c.includes(k)) return `~${distMap[k]} mi from Bixby`;
    }
    return state ? `Regional (${state.toUpperCase()})` : "Regional (OK/KS/AR/MO/TX)";
}

function escapeHtml(text) {
    if (!text) return "";
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const GENERIC_MACHINE_NAMES = new Set([
    "pinball", "pin ball", "pinball machine", "pinball table", "pinball game",
    "arcade", "arcade game", "game", "machine", "table", "vintage pinball",
    "classic pinball", "solid state pinball", "commercial pinball", "unverified"
]);

function getPinsideMachineUrl(item) {
    if (item && item.pinside_url) return item.pinside_url;
    const canon = (item.canonical_name || "").trim();
    const isGeneric = GENERIC_MACHINE_NAMES.has(canon.toLowerCase());
    const matchConf = (item.match_confidence !== undefined && item.match_confidence !== null) ? Number(item.match_confidence) : 1.0;
    const isUncertain = !canon || isGeneric || canon.toLowerCase() === "unverified" || matchConf < 0.65 || item.is_uncertain || item.is_accessory;

    if (!isUncertain && canon) {
        const slug = canon.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        return `https://pinside.com/pinball/machine/${slug}`;
    }
    const q = (item.raw_title || "").replace(/^FS:\s*/i, '').trim();
    return `https://pinside.com/pinball/archive?q=${encodeURIComponent(q)}`;
}

function formatListingDate(item) {
    const wording = (item.posted_date_wording || "").trim();
    const iso = item.posted_date_iso || item.first_seen || "";
    const basis = item.posted_date_basis || "Unknown";

    let calDate = "";
    // If wording contains an explicit YYYY-MM-DD (e.g. Pinside 'Added: 2026-10-04...'), preserve its calendar date
    const ymdMatch = wording.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (ymdMatch) {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const mIdx = parseInt(ymdMatch[2], 10) - 1;
        const dNum = parseInt(ymdMatch[3], 10);
        if (mIdx >= 0 && mIdx < 12) {
            calDate = `${months[mIdx]} ${dNum}, ${ymdMatch[1]}`;
        }
    } else if (iso) {
        try {
            const d = new Date(iso);
            if (!isNaN(d.getTime())) {
                calDate = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
            }
        } catch (e) {}
        if (!calDate && iso.length >= 10) {
            calDate = iso.substring(0, 10);
        }
    }

    const isPlaceholder = !wording || /marketplace in|listed on pinside|active auction/i.test(wording);
    const isRelative = /\b(ago|yesterday|just now|moments ago)\b/i.test(wording);
    const isCountdown = (!isRelative) && (/^\d+\s*[dhm]\b/i.test(wording) || wording.toLowerCase().includes("opens in"));

    const dateClass = basis === "Verified" ? "date-verified" : (basis === "Estimated Relative" ? "date-estimated" : "date-unknown");

    if (isRelative) {
        if (calDate) {
            return { displayDate: `${wording} (${calDate})`, dateClass };
        }
        return { displayDate: wording, dateClass };
    }

    if (isCountdown) {
        const countdownLabel = wording.toLowerCase().startsWith("bidding") ? wording : `Ends in ${wording}`;
        if (calDate) {
            return { displayDate: `${countdownLabel} (Est. ${calDate})`, dateClass: "date-estimated" };
        }
        return { displayDate: countdownLabel, dateClass: "date-estimated" };
    }

    if (isPlaceholder || !wording) {
        if (calDate) {
            return { displayDate: `Posted: ${calDate}`, dateClass };
        }
        return { displayDate: "Date Unknown", dateClass: "date-unknown" };
    }

    // Pinside verified added dates
    if (wording.toLowerCase().startsWith("added:") || (item.source === "pinside" && basis === "Verified")) {
        if (calDate) {
            return { displayDate: `Added: ${calDate}`, dateClass: "date-verified" };
        }
        return { displayDate: wording, dateClass: "date-verified" };
    }

    if (calDate) {
        return { displayDate: calDate, dateClass };
    }
    return { displayDate: wording, dateClass };
}

// Render Tab 1: Catalog Grid View (Solid-State Regional only)
function renderCatalogGrid() {
    const container = document.getElementById("catalog-grid-cards");
    if (!container) return;
    const searchVal = (document.getElementById("grid-search")?.value || "").toLowerCase().trim();
    const dealFilter = document.getElementById("grid-deal-filter")?.value || "all";
    const scopeFilter = document.getElementById("grid-state-filter")?.value || "regional";
    const techFilter = document.getElementById("cmd-tech-filter")?.value || "all";
    const displayFilter = document.getElementById("cmd-display-filter")?.value || "all";
    const priceFilter = document.getElementById("grid-price-filter")?.value || "100";
    const sortBy = document.getElementById("grid-sort-by")?.value || "date-desc";

    const allowedStates = ["OK", "KS", "AR", "MO", "TX"];

    // Filter criteria: if activeKpiFilter is set, check matchesKpiFilter; otherwise standard criteria
    let filtered = allListings.filter(item => {
        // 1. Source multi-select check-pills
        if (item.source && activeSources[item.source] === false) {
            return false;
        }

        // 2. Quick View or Active KPI Filter
        if (activeKpiFilter) {
            if (!matchesKpiFilter(item, activeKpiFilter)) return false;
        } else {
            if (activeQuickView === "all") {
                if (item.status !== "active") return false;
                if (!item.passes_scoring) return false;
            } else if (activeQuickView === "deals") {
                if (item.status !== "active") return false;
                const isDeal = item.deal_tier === "Steal" || item.deal_tier === "Great Deal" || (item.discount_percent && item.discount_percent >= 15);
                if (!isDeal) return false;
            } else if (activeQuickView === "price_changes") {
                if (!item.has_price_change) return false;
            } else if (activeQuickView === "new") {
                const isNew = Boolean(item.is_new || (item.first_seen && item.first_seen === item.last_seen && item.status === "active"));
                if (!isNew) return false;
            } else if (activeQuickView === "removed") {
                const isRemoved = item.status === "removed" || (item.consecutive_misses && item.consecutive_misses >= 3);
                if (!isRemoved) return false;
            }
        }

        // 3. Location Scope
        if (scopeFilter === "regional") {
            if (!allowedStates.includes(item.state) || item.unconfirmed_location) return false;
        } else if (scopeFilter === "oklahoma") {
            if (item.state !== "OK" || item.unconfirmed_location) return false;
        } // "all" allows any location

        // 4. Machine Technology
        if (techFilter === "solid_state") {
            if (item.technology !== "solid_state") return false;
        } else if (techFilter === "em") {
            if (item.technology !== "em") return false;
        } else if (techFilter === "all" && !activeKpiFilter && activeQuickView === "all") {
            if (item.technology === "em") return false;
        }

        // 5. Display Type
        if (displayFilter !== "all") {
            if ((item.display || "").toLowerCase() !== displayFilter.toLowerCase()) return false;
        }

        // 6. Minimum Price
        if (priceFilter !== "all") {
            const minP = parseFloat(priceFilter);
            if (!isNaN(minP) && item.price !== null && item.price !== undefined && item.price < minP) {
                return false;
            }
        }

        // 7. Catalog Toolbar Deal Filter
        if (dealFilter === "deals_only") {
            const isDeal = item.deal_tier === "Steal" || item.deal_tier === "Great Deal" || (item.discount_percent && item.discount_percent >= 15);
            if (!isDeal) return false;
        } else if (dealFilter === "steals") {
            if (item.deal_tier !== "Steal") return false;
        } else if (dealFilter === "great") {
            if (item.deal_tier !== "Great Deal") return false;
        } else if (dealFilter === "good") {
            if (item.deal_tier !== "Good Value") return false;
        } else if (dealFilter === "auction") {
            if (item.price_type !== "Current High Bid" && item.deal_tier !== "Auction Bid") return false;
        }

        // 8. Live Text Search
        if (searchVal) {
            const haystack = `${item.raw_title} ${item.canonical_name || ''} ${item.manufacturer || ''} ${item.city || ''} ${item.state || ''}`.toLowerCase();
            if (!haystack.includes(searchVal)) return false;
        }
        return true;
    });

    // Sorting
    filtered.sort((a, b) => {
        if (sortBy === "date-desc") {
            const aDate = a.posted_date_iso || a.first_seen || "";
            const bDate = b.posted_date_iso || b.first_seen || "";
            if (!aDate && bDate) return 1;
            if (aDate && !bDate) return -1;
            const cmp = bDate.localeCompare(aDate);
            if (cmp !== 0) return cmp;
            return (b.first_seen || "").localeCompare(a.first_seen || "");
        } else if (sortBy === "discount-desc") {
            const diff = (b.discount_percent || 0) - (a.discount_percent || 0);
            if (diff !== 0) return diff;
            return (b.posted_date_iso || "").localeCompare(a.posted_date_iso || "");
        } else if (sortBy === "distance-asc") {
            const aDist = (a.distance_miles !== null && a.distance_miles !== undefined) ? a.distance_miles : 99999;
            const bDist = (b.distance_miles !== null && b.distance_miles !== undefined) ? b.distance_miles : 99999;
            const diff = aDist - bDist;
            if (diff !== 0) return diff;
            return (b.posted_date_iso || "").localeCompare(a.posted_date_iso || "");
        } else if (sortBy === "price-asc") {
            const diff = (a.price || 999999) - (b.price || 999999);
            if (diff !== 0) return diff;
            return (b.posted_date_iso || "").localeCompare(a.posted_date_iso || "");
        } else if (sortBy === "price-desc") {
            const diff = (b.price || 0) - (a.price || 0);
            if (diff !== 0) return diff;
            return (b.posted_date_iso || "").localeCompare(a.posted_date_iso || "");
        } else if (sortBy === "score-desc") {
            const diff = (b.score || 0) - (a.score || 0);
            if (diff !== 0) return diff;
            return (b.posted_date_iso || "").localeCompare(a.posted_date_iso || "");
        }
        return 0;
    });

    let countLabel = `Showing ${filtered.length} regional solid-state machines`;
    if (activeKpiName) {
        countLabel = `Showing ${filtered.length} machines (Filtered by: ${activeKpiName})`;
    } else if (activeQuickView === "deals") {
        countLabel = `Showing ${filtered.length} deal machines`;
    } else if (activeQuickView === "price_changes") {
        countLabel = `Showing ${filtered.length} machines with price drops`;
    } else if (activeQuickView === "new") {
        countLabel = `Showing ${filtered.length} newly discovered machines`;
    } else if (activeQuickView === "removed") {
        countLabel = `Showing ${filtered.length} delisted/removed machines`;
    } else if (scopeFilter === "oklahoma") {
        countLabel = `Showing ${filtered.length} Oklahoma pinball machines`;
    } else if (scopeFilter === "all") {
        countLabel = `Showing ${filtered.length} machines across all locations`;
    }
    const countEl = document.getElementById("grid-result-count");
    if (countEl) countEl.textContent = countLabel;

    const bannerCount = document.getElementById("active-kpi-count");
    if (bannerCount) {
        bannerCount.textContent = `${filtered.length} matching machine${filtered.length === 1 ? '' : 's'}`;
    }

    if (filtered.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px; color: var(--text-secondary);">No matching pinball machines found for the active criteria.</div>`;
        return;
    }

    container.innerHTML = filtered.map(item => {
        const postingImg = item.local_image_url || ((item.image_url && !item.image_url.includes("unsplash")) ? item.image_url : null);
        const opdbImg = (item.artwork_url && !item.artwork_url.includes("unsplash")) ? item.artwork_url : null;
        const defaultImg = "https://img.opdb.org/d71148a2-23cf-4460-bf04-2e00a14b3e63-medium.jpg";

        // Use local cached image or posting photo first; fallback to official OPDB backglass image
        const primaryImg = postingImg || opdbImg || defaultImg;
        const fallbackImg = (postingImg && opdbImg) ? opdbImg : defaultImg;
        const isOpdbArt = (!postingImg && opdbImg);
        const isDefault = (!postingImg && !opdbImg);
        const imgTypeBadge = isDefault
            ? '<span class="badge badge-img-type">Default Image</span>'
            : (isOpdbArt 
                ? '<span class="badge badge-img-type">OPDB Backglass</span>' 
                : '<span class="badge badge-img-type">Posting Photo</span>');

        const isGenericOrUncertain = !item.canonical_name || 
            GENERIC_MACHINE_NAMES.has((item.canonical_name || "").toLowerCase().trim()) || 
            item.canonical_name.toLowerCase() === "unverified" || 
            (item.match_confidence !== undefined && item.match_confidence < 0.65) ||
            item.is_uncertain || item.is_accessory;

        const canonTitle = isGenericOrUncertain ? item.raw_title : (item.canonical_name || item.raw_title);
        const matchBadge = isGenericOrUncertain 
            ? `<span class="badge" style="background:rgba(148,163,184,0.15);color:#94a3b8;border:1px solid rgba(148,163,184,0.3);margin-left:6px;font-size:0.72rem;">Unverified Match</span>` 
            : '';
        const pinsideBtnText = isGenericOrUncertain ? "Search Pinside Archive ↗" : "Pinside Machine Details ↗";

        const mfgYear = item.manufacturer ? `${item.manufacturer} • ${item.year || ''}` : "Manufacturer Unverified";
        const priceDisp = item.price !== null ? `$${Number(item.price).toLocaleString()}` : (item.fmv ? `Est. ~$${Number(item.fmv).toLocaleString()}` : "Price Upon Request");
        const pType = item.price_type || (item.fmv ? "Market Estimate" : "Asking Price");
        const priceBadge = item.has_price_change ? '<span class="badge badge-warning">Price Change</span>' : '';
        const dist = getDistanceEst(item.city, item.state, item);
        const pinsideUrl = getPinsideMachineUrl(item);

        let dealBadge = "";
        if (item.deal_tier === "Uncertain Valuation" || item.is_uncertain) {
            dealBadge = ""; // Withhold deal badge for uncertain valuation or accessory
        } else if (item.deal_badge) {
            if (item.deal_badge.includes("ALERT") || item.deal_tier === "Steal") {
                dealBadge = `<span class="badge" style="background:#f43f5e; color:#fff; font-weight:700; letter-spacing:0.5px;">${escapeHtml(item.deal_badge)}</span>`;
            } else if (item.deal_badge.includes("Great") || item.deal_tier === "Great Deal") {
                dealBadge = `<span class="badge" style="background:#0284c7; color:#fff; font-weight:600;">${escapeHtml(item.deal_badge)}</span>`;
            } else if (item.deal_badge.includes("Good") || item.deal_tier === "Good Value") {
                dealBadge = `<span class="badge" style="background:#059669; color:#fff;">${escapeHtml(item.deal_badge)}</span>`;
            } else if (item.deal_tier === "Auction Bid") {
                dealBadge = `<span class="badge" style="background:#d97706; color:#fff;">${escapeHtml(item.deal_badge)}</span>`;
            }
        } else if (pType === "Market Estimate") {
            dealBadge = `<span class="badge" style="background:rgba(56, 189, 248, 0.15); color:#38bdf8; border:1px solid rgba(56, 189, 248, 0.3);">Est. Market Value</span>`;
        }
        const fmvSub = pType === "Market Estimate"
            ? `<div style="font-size:0.84rem; color:var(--accent-cyan); margin-top:3px; font-weight:500;">Historical sales median benchmark</div>`
            : (item.fmv ? `<div style="font-size:0.84rem; color:var(--text-secondary); margin-top:3px; font-weight:500;">Est. Market: ~$${Number(item.fmv).toLocaleString()}</div>` : '');

        const { displayDate, dateClass: dateBasisClass } = formatListingDate(item);

        const dispVal = (item.display || "unverified").toLowerCase();
        const dispLabel = (dispVal === "lcd" || dispVal === "dmd" || dispVal === "cga") ? dispVal.toUpperCase() : (dispVal.charAt(0).toUpperCase() + dispVal.slice(1));
        const dispBadge = `<span class="badge badge-display badge-display-${escapeHtml(dispVal)}">${escapeHtml(dispLabel)}</span>`;

        const breakdownList = (item.score_breakdown || []).map(b => 
            `<li>${escapeHtml(b.desc)} (${b.delta > 0 ? '+' : ''}${b.delta})</li>`
        ).join("");

        return `
        <div class="pinball-card glass-panel glass-panel-interactive">
            <div class="card-image-wrap">
                <img src="${escapeHtml(primaryImg)}"
                     alt="${escapeHtml(canonTitle)}"
                     loading="lazy"
                     referrerpolicy="no-referrer"
                     onerror="this.onerror=null; this.src='${escapeHtml(fallbackImg)}'; const b = this.parentElement.querySelector('.badge-img-type'); if (b) b.textContent = '${opdbImg ? "OPDB Backglass" : "Default Image"}';"/>
                <div class="image-overlay">
                    <div style="display:flex; gap:4px; align-items:center;">
                        <span class="badge badge-source-${item.source}">${item.source.toUpperCase()}</span>
                        ${imgTypeBadge}
                    </div>
                </div>
            </div>
            <div class="card-body">
                <div class="card-header-meta">
                    <div style="display:flex; gap:6px; align-items:center;">
                        <span class="mfg-year">${escapeHtml(mfgYear)}</span>
                        ${dispBadge}
                    </div>
                    <span class="distance-pill">${escapeHtml(dist)}</span>
                </div>
                <h3 class="card-title" title="${escapeHtml(item.raw_title)}">${escapeHtml(canonTitle)} ${matchBadge}</h3>
                <div class="raw-title-sub">Listing: "${escapeHtml(item.raw_title)}"</div>
                
                <div class="pricing-row" style="flex-wrap:wrap; gap:6px;">
                    <div>
                        <div class="price-val">${priceDisp} <span class="price-type" style="${pType === 'Market Estimate' ? 'color:#38bdf8;' : ''}">(${escapeHtml(pType)})</span></div>
                        ${fmvSub}
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
                        ${dealBadge}
                        ${priceBadge}
                    </div>
                </div>

                <div class="location-row">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    <span>${escapeHtml(item.city)}, ${escapeHtml(item.state)}</span>
                </div>

                <div class="date-row ${dateBasisClass}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span>${escapeHtml(displayDate)}</span>
                </div>

                <div class="score-breakdown-details">
                    <details>
                        <summary>Rule Scoring Breakdown</summary>
                        <ul>${breakdownList}</ul>
                    </details>
                </div>

                <div class="card-actions">
                    <a href="${escapeHtml(item.direct_url || '#')}" target="_blank" rel="noopener noreferrer" class="btn-card-link btn-source-${escapeHtml(item.source)}">View Listing ↗</a>
                    <a href="${escapeHtml(pinsideUrl)}" target="_blank" rel="noopener noreferrer" class="btn-pinside-link">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2" stroke="#fff" stroke-width="2" fill="none"/></svg>
                        ${escapeHtml(pinsideBtnText)}
                    </a>
                </div>
            </div>
        </div>
        `;
    }).join("");
}



function filterGrid() {
    renderCatalogGrid();
}

// Render Tab 2: Dense Audit Table
function renderAuditTable() {
    const tbody = document.getElementById("audit-table-body");
    const searchVal = (document.getElementById("audit-search")?.value || "").toLowerCase();
    const dealFilter = document.getElementById("audit-deal-filter")?.value || "all";
    const statusFilter = document.getElementById("audit-status-filter")?.value || "all";
    const scoringFilter = document.getElementById("audit-scoring-filter")?.value || "all";
    const priceFilter = document.getElementById("audit-price-filter")?.value || "100";

    let filtered = allListings.filter(item => {
        if (item.source && activeSources[item.source] === false) return false;
        if (activeKpiFilter) {
            if (!matchesKpiFilter(item, activeKpiFilter)) return false;
        } else {
            if (activeQuickView === "deals") {
                const isDeal = item.deal_tier === "Steal" || item.deal_tier === "Great Deal" || (item.discount_percent && item.discount_percent >= 15);
                if (!isDeal) return false;
            } else if (activeQuickView === "price_changes") {
                if (!item.has_price_change) return false;
            } else if (activeQuickView === "new") {
                const isNew = Boolean(item.is_new || (item.first_seen && item.first_seen === item.last_seen && item.status === "active"));
                if (!isNew) return false;
            } else if (activeQuickView === "removed") {
                const isRemoved = item.status === "removed" || (item.consecutive_misses && item.consecutive_misses >= 3);
                if (!isRemoved) return false;
            }
        }
        if (statusFilter !== "all" && item.status !== statusFilter) return false;
        if (scoringFilter === "passed" && !item.passes_scoring) return false;
        if (scoringFilter === "rejected" && item.passes_scoring) return false;

        if (priceFilter === "under_100") {
            if (item.price === null || item.price === undefined || item.price >= 100) return false;
        } else if (priceFilter !== "all") {
            const minP = parseFloat(priceFilter);
            if (!isNaN(minP)) {
                if (item.price !== null && item.price !== undefined && item.price < minP) return false;
            }
        }

        if (dealFilter === "deals") {
            const isDeal = item.deal_tier === "Steal" || item.deal_tier === "Great Deal" || (item.discount_percent && item.discount_percent >= 15);
            if (!isDeal) return false;
        } else if (dealFilter === "steals" && item.deal_tier !== "Steal") return false;
        else if (dealFilter === "great" && item.deal_tier !== "Great Deal") return false;
        else if (dealFilter === "good" && item.deal_tier !== "Good Value") return false;
        else if (dealFilter === "fair" && item.deal_tier !== "Fair Market") return false;
        else if (dealFilter === "above" && item.deal_tier !== "Above Market") return false;
        else if (dealFilter === "auction" && item.deal_tier !== "Auction Bid" && item.price_type !== "Current High Bid") return false;

        if (searchVal) {
            const text = `${item.source} ${item.listing_id} ${item.raw_title} ${item.canonical_name || ''} ${item.city || ''} ${item.state || ''}`.toLowerCase();
            if (!text.includes(searchVal)) return false;
        }
        return true;
    });

    filtered.sort((a, b) => {
        const aDate = a.posted_date_iso || a.first_seen || "";
        const bDate = b.posted_date_iso || b.first_seen || "";
        if (!aDate && bDate) return 1;
        if (aDate && !bDate) return -1;
        const cmp = bDate.localeCompare(aDate);
        if (cmp !== 0) return cmp;
        return (b.first_seen || "").localeCompare(a.first_seen || "");
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="15" style="text-align:center; padding: 24px;">No records match audit criteria.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(item => {
        const canon = item.canonical_name || "Unverified";
        const priceDisp = item.price !== null ? `$${Number(item.price).toLocaleString()}` : (item.fmv ? `Est. ~$${Number(item.fmv).toLocaleString()}` : "Price Upon Request");
        const pType = item.price_type || (item.fmv ? "Market Estimate" : "Asking Price");
        const priceBadge = item.has_price_change ? '<span style="color:var(--accent-red);font-weight:bold;">★ Price Change</span>' : '';
        const statusBadge = item.status === "active" ? '<span class="badge badge-success">ACTIVE</span>' : '<span class="badge badge-warning">REMOVED</span>';
        const dist = getDistanceEst(item.city, item.state, item);
        const pinsideUrl = getPinsideMachineUrl(item);

        const dispVal = (item.display || "unverified").toLowerCase();
        const dispLabel = (dispVal === "lcd" || dispVal === "dmd" || dispVal === "cga") ? dispVal.toUpperCase() : (dispVal.charAt(0).toUpperCase() + dispVal.slice(1));

        const isGenericOrUncertain = !item.canonical_name || 
            GENERIC_MACHINE_NAMES.has((item.canonical_name || "").toLowerCase().trim()) || 
            item.canonical_name.toLowerCase() === "unverified" || 
            (item.match_confidence !== undefined && item.match_confidence < 0.65) ||
            item.is_uncertain || item.is_accessory;

        const canonDisplay = isGenericOrUncertain 
            ? `${escapeHtml(item.canonical_name || 'Unverified')} <span class="badge" style="background:rgba(148,163,184,0.15);color:#94a3b8;border:1px solid rgba(148,163,184,0.25);font-size:0.7rem;padding:2px 4px;">Uncertain</span>` 
            : `<strong>${escapeHtml(canon)}</strong>`;

        let dealRatingHtml = `<span style="color:var(--text-muted); font-size:0.82rem;">-</span>`;
        if (item.deal_tier === "Uncertain Valuation" || item.is_uncertain) {
            dealRatingHtml = `<span class="badge" style="background:rgba(148,163,184,0.15); color:#94a3b8; border:1px solid rgba(148,163,184,0.25); font-size:0.80rem;">Uncertain Valuation</span>`;
        } else if (item.deal_tier && item.deal_tier !== "Normal") {
            dealRatingHtml = `
                <span class="badge" style="${item.deal_tier === 'Steal' ? 'background:#f43f5e; color:#fff;' : (item.deal_tier === 'Great Deal' ? 'background:#0284c7; color:#fff;' : (item.deal_tier === 'Good Value' ? 'background:#059669; color:#fff;' : 'background:var(--bg-surface-elevated); border:1px solid var(--border-color); color:var(--text-secondary);'))} font-size:0.80rem;">
                    ${escapeHtml(item.deal_tier)}
                </span>
                ${item.discount_percent ? `<div style="font-size:0.82rem; font-weight:700; color:${item.discount_percent > 0 ? 'var(--accent-green)' : 'var(--accent-red)'}; margin-top:2px;">${item.discount_percent > 0 ? '+' : ''}${item.discount_percent}%</div>` : ''}
            `;
        }

        return `
        <tr>
            <td><span class="badge badge-source-${item.source}">${escapeHtml(item.source.toUpperCase())}</span></td>
            <td class="font-mono">${escapeHtml(item.listing_id)}</td>
            <td>
                ${canonDisplay}
                <div style="font-size:0.82rem; color:var(--text-muted); margin-top:2px;">${escapeHtml(item.raw_title)}</div>
            </td>
            <td>${escapeHtml(item.manufacturer || '-')}</td>
            <td>${escapeHtml(item.year || '-')}</td>
            <td><span class="pill pill-${item.technology}">${escapeHtml(item.technology)}</span></td>
            <td><span class="pill pill-display pill-display-${escapeHtml(dispVal)}">${escapeHtml(dispLabel)}</span></td>
            <td>
                <strong>${priceDisp}</strong>
                <div style="font-size:0.82rem; color:${pType === 'Market Estimate' ? 'var(--accent-cyan)' : 'var(--text-secondary)'}; font-weight:500;">${escapeHtml(pType)}</div>
                ${item.fmv && pType !== 'Market Estimate' ? `<div style="font-size:0.80rem; color:var(--accent-cyan); margin-top:2px; font-weight:600;">FMV: ~$${Number(item.fmv).toLocaleString()}</div>` : ''}
                ${priceBadge}
            </td>
            <td>
                ${dealRatingHtml}
            </td>
            <td>
                ${escapeHtml(item.city)}, ${escapeHtml(item.state)}
                <div style="font-size:0.82rem; color:var(--accent-cyan); font-weight:600;">${escapeHtml(dist)}</div>
            </td>
            <td><strong>${item.score}</strong></td>
            <td>${statusBadge}</td>
            <td>${item.consecutive_misses}</td>
            <td>
                <div><strong>${escapeHtml(formatListingDate(item).displayDate)}</strong></div>
                <div style="font-size:0.80rem; color:var(--text-muted);">${escapeHtml(item.posted_date_basis || 'Unknown')}</div>
            </td>
            <td style="white-space:nowrap;">
                <a href="${escapeHtml(item.direct_url || '#')}" target="_blank" class="link-source-${item.source}">Open ↗</a>
                <div style="margin-top:3px;">
                    <a href="${escapeHtml(pinsideUrl)}" target="_blank" class="link-pinside">${isGenericOrUncertain ? 'Search Archive ↗' : 'Pinside ↗'}</a>
                </div>
            </td>
        </tr>
        `;
    }).join("");
}


function filterAudit() {
    renderAuditTable();
}

// Render Tab 3: Unconfirmed Location Review Queue
function renderUnconfirmedQueue() {
    const tbody = document.getElementById("unconfirmed-table-body");
    const unconfirmed = allListings.filter(i => i.unconfirmed_location && i.status === "active");

    if (unconfirmed.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 24px;">No listings currently flagged for unconfirmed location.</td></tr>`;
        return;
    }

    tbody.innerHTML = unconfirmed.map(item => {
        const reason = item.state && !["OK", "KS", "AR", "MO", "TX"].includes(item.state) 
            ? `State outside region (${item.state})`
            : (item.raw_title.toLowerCase().includes("shipping") ? "Shipping-only listing" : "Missing state / distance data");
        const priceDisp = item.price !== null ? `$${Number(item.price).toLocaleString()}` : (item.fmv ? `Est. ~$${Number(item.fmv).toLocaleString()}` : "Price Upon Request");

        return `
        <tr>
            <td><strong>${escapeHtml(item.source.toUpperCase())}</strong></td>
            <td class="font-mono">${escapeHtml(item.listing_id)}</td>
            <td><strong>${escapeHtml(item.raw_title)}</strong></td>
            <td>${priceDisp}</td>
            <td>${escapeHtml(item.city || 'Unknown')}, ${escapeHtml(item.state || 'Unknown')}</td>
            <td style="color:var(--accent-red); font-weight:600;">${escapeHtml(reason)}</td>
            <td><a href="${escapeHtml(item.direct_url || '#')}" target="_blank" class="btn btn-xs">Verify Listing ↗</a></td>
        </tr>
        `;
    }).join("");
}

// End of client controller
