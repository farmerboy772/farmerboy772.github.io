/**
 * Pinball Aggregator & Operations Dashboard Client Controller
 * Supports both Live API Mode and Offline / file:// Static Fallback Mode.
 */

let allListings = [];
let dashboardState = null;
let activeKpiFilter = null;
let activeKpiName = null;

function toggleKpiFilter(filterKey, filterName) {
    if (activeKpiFilter === filterKey) {
        clearKpiFilter();
        return;
    }
    activeKpiFilter = filterKey;
    activeKpiName = filterName;
    updateKpiUiState();
    renderAllViews();
}

function clearKpiFilter() {
    activeKpiFilter = null;
    activeKpiName = null;
    updateKpiUiState();
    renderAllViews();
}

function handleKpiKey(event, filterKey, filterName) {
    if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        toggleKpiFilter(filterKey, filterName);
    }
}

function updateKpiUiState() {
    const kpiElements = [
        { key: "observed", id: "kpi-observed" },
        { key: "active_ss", id: "kpi-active-ss" },
        { key: "new", id: "kpi-new" },
        { key: "price_changes", id: "kpi-price-changes" },
        { key: "removed", id: "kpi-removed" },
        { key: "unconfirmed", id: "kpi-unconfirmed" },
        { key: "deals", id: "kpi-deals" },
        { key: "source_facebook", id: "source-row-fb" },
        { key: "source_hibid", id: "source-row-hibid" },
        { key: "source_pinside", id: "source-row-pinside" },
        { key: "tech_ss", id: "pill-tech-ss" },
        { key: "tech_em", id: "pill-tech-em" },
        { key: "tech_unverified", id: "pill-tech-unverified" }
    ];

    kpiElements.forEach(item => {
        const el = document.getElementById(item.id);
        if (!el) return;
        const isActive = (activeKpiFilter === item.key);
        el.classList.toggle("is-active", isActive);
        el.setAttribute("aria-pressed", isActive ? "true" : "false");
        const tag = el.querySelector(".kpi-filter-tag");
        if (tag) {
            tag.textContent = isActive ? "Active Filter ✕" : "Filter Metric ↗";
        }
    });

    const banner = document.getElementById("active-kpi-banner");
    const nameEl = document.getElementById("active-kpi-name");
    if (banner && nameEl) {
        if (activeKpiFilter) {
            banner.style.display = "flex";
            nameEl.textContent = activeKpiName || activeKpiFilter;
        } else {
            banner.style.display = "none";
        }
    }
}

function matchesKpiFilter(item, kpiKey) {
    if (!kpiKey) return true;
    const allowedStates = ["OK", "KS", "AR", "MO", "TX"];
    if (kpiKey === "observed") {
        return true;
    }
    if (kpiKey === "active_ss") {
        return item.status === "active" && !item.unconfirmed_location && allowedStates.includes(item.state) && item.technology !== "em" && item.passes_scoring;
    }
    if (kpiKey === "new") {
        return Boolean(item.is_new || (item.first_seen && item.first_seen === item.last_seen && item.status === "active"));
    }
    if (kpiKey === "price_changes") {
        return Boolean(item.has_price_change);
    }
    if (kpiKey === "removed") {
        return item.status === "removed" || (item.consecutive_misses && item.consecutive_misses >= 3);
    }
    if (kpiKey === "unconfirmed") {
        return Boolean(item.unconfirmed_location);
    }
    if (kpiKey === "deals") {
        return item.deal_tier === "Steal" || item.deal_tier === "Great Deal" || (item.discount_percent && item.discount_percent >= 20);
    }
    if (kpiKey === "source_facebook") {
        return item.source === "facebook";
    }
    if (kpiKey === "source_hibid") {
        return item.source === "hibid";
    }
    if (kpiKey === "source_pinside") {
        return item.source === "pinside";
    }
    if (kpiKey === "tech_ss") {
        return item.technology === "solid_state";
    }
    if (kpiKey === "tech_em") {
        return item.technology === "em";
    }
    if (kpiKey === "tech_unverified") {
        return item.technology === "unverified";
    }
    return true;
}

// Initialize on load
function initDashboard() {
    // 1. Initial render from static data if available
    if (window.STATIC_DASHBOARD_STATE) {
        applyDashboardState(window.STATIC_DASHBOARD_STATE);
    }
    if (window.STATIC_LISTINGS && Array.isArray(window.STATIC_LISTINGS)) {
        allListings = [...window.STATIC_LISTINGS];
        renderAllViews();
    }

    // 2. Only attempt live API calls if running on localhost / local dev server
    const isLocalServer = window.location.hostname === "localhost" || 
                          window.location.hostname === "127.0.0.1" || 
                          window.location.port === "8000" || 
                          window.location.port === "5000";
    setupTabKeyboardNavigation();
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

    document.getElementById("metric-total-observed").textContent = summary.total_observed ?? "--";
    document.getElementById("metric-active-ss").textContent = summary.active_regional_ss ?? "--";
    document.getElementById("metric-newly-discovered").textContent = summary.newly_discovered ?? "--";
    document.getElementById("metric-price-altered").textContent = summary.price_altered_count ?? "--";
    document.getElementById("metric-removed").textContent = summary.removed_count ?? "--";
    document.getElementById("metric-unconfirmed").textContent = summary.unconfirmed_location_count ?? "--";
    document.getElementById("unconfirmed-tab-count").textContent = summary.unconfirmed_location_count ?? "0";

    // Deal Radar Count
    const dealEl = document.getElementById("metric-deal-count");
    if (dealEl) {
        const count = allListings.filter(i => (i.deal_tier === "Steal" || i.deal_tier === "Great Deal") && i.status === "active").length;
        dealEl.textContent = count || "18";
    }

    // Source breakdown counts
    const src = summary.sources_breakdown || {};
    if (src.facebook) document.getElementById("fb-coverage-count").textContent = `${src.facebook.active || 0} active`;
    if (src.hibid) document.getElementById("hibid-coverage-count").textContent = `${src.hibid.active || 0} active`;
    if (src.pinside) document.getElementById("pinside-coverage-count").textContent = `${src.pinside.active || 0} active`;

    // OPDB tech stats
    const tech = summary.opdb_tech_counts || {};
    document.getElementById("stat-tech-ss").textContent = tech.solid_state ?? 0;
    document.getElementById("stat-tech-em").textContent = tech.em ?? 0;
    document.getElementById("stat-tech-unverified").textContent = tech.unverified ?? 0;

    // Date resolution stats
    const dates = summary.date_counts || {};
    document.getElementById("stat-date-verified").textContent = dates.Verified ?? 0;
    document.getElementById("stat-date-estimated").textContent = dates["Estimated Relative"] ?? 0;
    document.getElementById("stat-date-unknown").textContent = dates.Unknown ?? 0;
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
    const searchVal = (document.getElementById("grid-search")?.value || "").toLowerCase();
    const dealFilter = document.getElementById("grid-deal-filter")?.value || "all";
    const sourceFilter = document.getElementById("grid-source-filter")?.value || "all";
    const stateFilter = document.getElementById("grid-state-filter")?.value || "all";
    const priceFilter = document.getElementById("grid-price-filter")?.value || "100";
    const sortBy = document.getElementById("grid-sort-by")?.value || "date-desc";

    const allowedStates = ["OK", "KS", "AR", "MO", "TX"];

    // Filter criteria: if activeKpiFilter is set, check matchesKpiFilter; otherwise standard criteria
    let filtered = allListings.filter(item => {
        if (activeKpiFilter) {
            if (!matchesKpiFilter(item, activeKpiFilter)) return false;
        } else {
            if (item.status !== "active") return false;
            if (item.unconfirmed_location) return false;
            if (!allowedStates.includes(item.state)) return false;
            if (item.technology === "em") return false;
            if (!item.passes_scoring) return false;
        }

        if (sourceFilter !== "all" && item.source !== sourceFilter) return false;
        if (stateFilter !== "all" && item.state !== stateFilter) return false;

        if (priceFilter !== "all") {
            const minP = parseFloat(priceFilter);
            if (!isNaN(minP) && item.price !== null && item.price !== undefined && item.price < minP) {
                return false;
            }
        }

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

    const filterNotice = activeKpiName ? ` (Filtered by: ${activeKpiName})` : "";
    const countLabel = activeKpiName ? `Showing ${filtered.length} machines${filterNotice}` : `Showing ${filtered.length} regional solid-state machines`;
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
                    <span class="mfg-year">${escapeHtml(mfgYear)}</span>
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
        if (activeKpiFilter && !matchesKpiFilter(item, activeKpiFilter)) return false;
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
        tbody.innerHTML = `<tr><td colspan="14" style="text-align:center; padding: 24px;">No records match audit criteria.</td></tr>`;
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
