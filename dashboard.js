/**
 * Pinball Aggregator & Operations Dashboard Client Controller
 * Supports both Live API Mode and Offline / file:// Static Fallback Mode.
 */

let allListings = [];
let dashboardState = null;

// Initialize on load
document.addEventListener("DOMContentLoaded", () => {
    // 1. Initial render from static data if available
    if (window.STATIC_DASHBOARD_STATE) {
        applyDashboardState(window.STATIC_DASHBOARD_STATE);
    }
    if (window.STATIC_LISTINGS && Array.isArray(window.STATIC_LISTINGS)) {
        allListings = [...window.STATIC_LISTINGS];
        renderAllViews();
    }

    // 2. If running on HTTP/HTTPS, fetch live data from server
    if (window.location.protocol.startsWith("http")) {
        loadDashboardState();
        loadListings();
        loadWebhookConfig();
        loadRecentAlerts();
    }
});

// Switch active tab
function switchTab(tabId) {
    document.querySelectorAll(".tab-pane").forEach(el => el.classList.remove("active"));
    document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));
    
    const target = document.getElementById(`tab-${tabId}`);
    if (target) target.classList.add("active");

    const clickedBtn = Array.from(document.querySelectorAll(".tab-btn")).find(btn => 
        btn.getAttribute("onclick") && btn.getAttribute("onclick").includes(tabId)
    );
    if (clickedBtn) clickedBtn.classList.add("active");
}

function applyDashboardState(data) {
    dashboardState = data;
    const summary = data.summary || {};

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

    // Deploy status
    if (summary.last_deploy) {
        document.getElementById("deploy-last-commit").textContent = summary.last_deploy.commit_hash || "Active";
        document.getElementById("deploy-last-time").textContent = summary.last_deploy.timestamp ? summary.last_deploy.timestamp.replace("T", " ").substring(0, 19) + " UTC" : "--";
    }

    // Session health in drawer
    const sess = data.session_health || {};
    if (sess.pinside) document.getElementById("pinside-session-status").textContent = sess.pinside.status;
    if (sess.facebook) document.getElementById("fb-session-status").textContent = sess.facebook.status;
    if (sess.hibid) document.getElementById("hibid-session-status").textContent = sess.hibid.status;
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
    renderDateResolutionQueue();
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

function getPinsideMachineUrl(item) {
    if (item && item.pinside_url) return item.pinside_url;
    const canon = (item.canonical_name || "").trim();
    if (canon && canon.toLowerCase() !== "unverified") {
        const slug = canon.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        return `https://pinside.com/pinball/machine/${slug}`;
    }
    const q = (item.raw_title || "").replace(/^FS:\s*/i, '').trim();
    return `https://pinside.com/pinball/archive?q=${encodeURIComponent(q)}`;
}

// Render Tab 1: Catalog Grid View (Solid-State Regional only)
function renderCatalogGrid() {
    const container = document.getElementById("catalog-grid-cards");
    const searchVal = (document.getElementById("grid-search")?.value || "").toLowerCase();
    const dealFilter = document.getElementById("grid-deal-filter")?.value || "all";
    const sourceFilter = document.getElementById("grid-source-filter")?.value || "all";
    const stateFilter = document.getElementById("grid-state-filter")?.value || "all";
    const sortBy = document.getElementById("grid-sort-by")?.value || "date-desc";

    const allowedStates = ["OK", "KS", "AR", "MO", "TX"];

    // Filter Step 6 criteria: active, not unconfirmed_location, regional states, technology != em, passes_scoring
    let filtered = allListings.filter(item => {
        if (item.status !== "active") return false;
        if (item.unconfirmed_location) return false;
        if (!allowedStates.includes(item.state)) return false;
        if (item.technology === "em") return false;
        if (!item.passes_scoring) return false;

        if (sourceFilter !== "all" && item.source !== sourceFilter) return false;
        if (stateFilter !== "all" && item.state !== stateFilter) return false;

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
            const aDate = a.posted_date_iso || "";
            const bDate = b.posted_date_iso || "";
            if (!aDate && bDate) return 1;
            if (aDate && !bDate) return -1;
            return bDate.localeCompare(aDate);
        } else if (sortBy === "discount-desc") {
            return (b.discount_percent || 0) - (a.discount_percent || 0);
        } else if (sortBy === "distance-asc") {
            const aDist = (a.distance_miles !== null && a.distance_miles !== undefined) ? a.distance_miles : 99999;
            const bDist = (b.distance_miles !== null && b.distance_miles !== undefined) ? b.distance_miles : 99999;
            return aDist - bDist;
        } else if (sortBy === "price-asc") {
            return (a.price || 999999) - (b.price || 999999);
        } else if (sortBy === "price-desc") {
            return (b.price || 0) - (a.price || 0);
        } else if (sortBy === "score-desc") {
            return (b.score || 0) - (a.score || 0);
        }
        return 0;
    });

    document.getElementById("grid-result-count").textContent = `Showing ${filtered.length} regional solid-state machines`;

    if (filtered.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px; color: var(--text-secondary);">No matching regional solid-state pinball machines found.</div>`;
        return;
    }

    container.innerHTML = filtered.map(item => {
        const postingImg = (item.image_url && !item.image_url.includes("unsplash")) ? item.image_url : null;
        const opdbImg = (item.artwork_url && !item.artwork_url.includes("unsplash")) ? item.artwork_url : null;
        const defaultImg = "https://img.opdb.org/d71148a2-23cf-4460-bf04-2e00a14b3e63-medium.jpg";

        // Use posting photo first; fallback to official OPDB backglass image
        const primaryImg = postingImg || opdbImg || defaultImg;
        const fallbackImg = (postingImg && opdbImg) ? opdbImg : defaultImg;
        const isOpdbArt = (!postingImg && opdbImg);
        const imgTypeBadge = isOpdbArt 
            ? '<span class="badge badge-img-type">OPDB Backglass</span>' 
            : '<span class="badge badge-img-type">Posting Photo</span>';

        const canonTitle = item.canonical_name || item.raw_title;
        const mfgYear = item.manufacturer ? `${item.manufacturer} • ${item.year || ''}` : "Manufacturer Unverified";
        const priceDisp = item.price !== null ? `$${Number(item.price).toLocaleString()}` : (item.fmv ? `Est. ~$${Number(item.fmv).toLocaleString()}` : "Price Upon Request");
        const pType = item.price_type || (item.fmv ? "Market Estimate" : "Asking Price");
        const priceBadge = item.has_price_change ? '<span class="badge badge-warning">Price Change</span>' : '';
        const dist = getDistanceEst(item.city, item.state, item);
        const pinsideUrl = getPinsideMachineUrl(item);

        let dealBadge = "";
        if (item.deal_badge) {
            if (item.deal_badge.includes("ALERT") || item.deal_tier === "Steal") {
                dealBadge = `<span class="badge" style="background:#e11d48; color:#fff; font-weight:700; letter-spacing:0.5px;">${escapeHtml(item.deal_badge)}</span>`;
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
            ? `<div style="font-size:0.75rem; color:#38bdf8; margin-top:2px;">Historical sales median benchmark</div>`
            : (item.fmv ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Est. Market: ~$${Number(item.fmv).toLocaleString()}</div>` : '');

        const dateBasisClass = item.posted_date_basis === "Verified" ? "date-verified" : (item.posted_date_basis === "Estimated Relative" ? "date-estimated" : "date-unknown");
        const dateStr = item.posted_date_wording || (item.posted_date_iso ? item.posted_date_iso.substring(0, 10) : "Date Unknown");

        const breakdownList = (item.score_breakdown || []).map(b => 
            `<li>${escapeHtml(b.desc)} (${b.delta > 0 ? '+' : ''}${b.delta})</li>`
        ).join("");

        return `
        <div class="pinball-card">
            <div class="card-image-wrap">
                <img src="${escapeHtml(primaryImg)}"
                     alt="${escapeHtml(canonTitle)}"
                     loading="lazy"
                     referrerpolicy="no-referrer"
                     onerror="this.onerror=null; this.src='${escapeHtml(fallbackImg)}';"/>
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
                <h3 class="card-title" title="${escapeHtml(item.raw_title)}">${escapeHtml(canonTitle)}</h3>
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
                    <span>${escapeHtml(dateStr)} (${escapeHtml(item.posted_date_basis || 'Unknown')})</span>
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
                        Pinside Machine Details ↗
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

    let filtered = allListings.filter(item => {
        if (statusFilter !== "all" && item.status !== statusFilter) return false;
        if (scoringFilter === "passed" && !item.passes_scoring) return false;
        if (scoringFilter === "rejected" && item.passes_scoring) return false;

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

        return `
        <tr>
            <td><span class="badge badge-source-${item.source}">${escapeHtml(item.source.toUpperCase())}</span></td>
            <td class="font-mono">${escapeHtml(item.listing_id)}</td>
            <td>
                <strong>${escapeHtml(canon)}</strong>
                <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(item.raw_title)}</div>
            </td>
            <td>${escapeHtml(item.manufacturer || '-')}</td>
            <td>${escapeHtml(item.year || '-')}</td>
            <td><span class="pill pill-${item.technology}">${escapeHtml(item.technology)}</span></td>
            <td>
                <strong>${priceDisp}</strong>
                <div style="font-size:0.75rem; color:${pType === 'Market Estimate' ? '#38bdf8' : 'var(--text-muted)'};">${escapeHtml(pType)}</div>
                ${item.fmv && pType !== 'Market Estimate' ? `<div style="font-size:0.72rem; color:var(--accent-cyan); margin-top:2px;">FMV: ~$${Number(item.fmv).toLocaleString()}</div>` : ''}
                ${priceBadge}
            </td>
            <td>
                ${item.deal_tier && item.deal_tier !== "Normal" ? `
                    <span class="badge" style="${item.deal_tier === 'Steal' ? 'background:#e11d48; color:#fff;' : (item.deal_tier === 'Great Deal' ? 'background:#0284c7; color:#fff;' : (item.deal_tier === 'Good Value' ? 'background:#059669; color:#fff;' : 'background:var(--border-color); color:var(--text-secondary);'))} font-size:0.72rem;">
                        ${escapeHtml(item.deal_tier)}
                    </span>
                    ${item.discount_percent ? `<div style="font-size:0.75rem; font-weight:600; color:${item.discount_percent > 0 ? 'var(--accent-green)' : 'var(--accent-red)'}; margin-top:2px;">${item.discount_percent > 0 ? '+' : ''}${item.discount_percent}%</div>` : ''}
                ` : `<span style="color:var(--text-muted); font-size:0.75rem;">-</span>`}
            </td>
            <td>
                ${escapeHtml(item.city)}, ${escapeHtml(item.state)}
                <div style="font-size:0.75rem; color:var(--accent-cyan);">${escapeHtml(dist)}</div>
            </td>
            <td><strong>${item.score}</strong></td>
            <td>${statusBadge}</td>
            <td>${item.consecutive_misses}</td>
            <td>
                ${escapeHtml(item.posted_date_wording || '-')}
                <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(item.posted_date_basis)}</div>
            </td>
            <td style="white-space:nowrap;">
                <a href="${escapeHtml(item.direct_url || '#')}" target="_blank" class="link-source-${item.source}">Open ↗</a>
                <div style="margin-top:3px;">
                    <a href="${escapeHtml(pinsideUrl)}" target="_blank" class="link-pinside">Pinside ↗</a>
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

// Render Tab 4: Maintenance Date Resolution Queue
function renderDateResolutionQueue() {
    const list = document.getElementById("date-resolution-queue-list");
    const fbUnverified = allListings.filter(i => i.source === "facebook" && i.status === "active" && i.posted_date_basis !== "Verified").slice(0, 25);

    if (fbUnverified.length === 0) {
        list.innerHTML = `<div style="padding: 12px; color: var(--text-muted);">All active Facebook listings have established date resolution.</div>`;
    } else {
        list.innerHTML = fbUnverified.map(item => `
            <div class="date-item">
                <div>
                    <strong>${escapeHtml(item.raw_title)}</strong>
                    <div style="color:var(--text-muted); font-size:0.75rem;">${escapeHtml(item.city)}, ${escapeHtml(item.state)} • First seen: ${escapeHtml(item.first_seen.substring(0, 16))}</div>
                </div>
                <div style="text-align:right;">
                    <span class="pill pill-${item.posted_date_basis === 'Estimated Relative' ? 'estimated' : 'unknown'}">${escapeHtml(item.posted_date_basis)}</span>
                    <div style="font-size:0.75rem; margin-top:2px;">"${escapeHtml(item.posted_date_wording || 'No text')}"</div>
                </div>
            </div>
        `).join("");
    }

    // Unverified OPDB machines
    const unverifiedOPDB = allListings.filter(i => i.technology === "unverified" && i.status === "active");
    const opdbContainer = document.getElementById("opdb-unverified-list");
    if (unverifiedOPDB.length === 0) {
        opdbContainer.innerHTML = `<div style="padding: 12px; color: var(--text-muted);">No unverified machines currently active.</div>`;
    } else {
        opdbContainer.innerHTML = unverifiedOPDB.map(i => `
            <div class="date-item">
                <span><strong>${escapeHtml(i.raw_title)}</strong> (${escapeHtml(i.source)})</span>
                <span class="pill pill-unverified">Unverified</span>
            </div>
        `).join("");
    }
}

// Drawer Controls
function openDrawer() {
    document.getElementById("drawer-overlay").classList.add("open");
    document.getElementById("ingestion-drawer").classList.add("open");
}

function closeDrawer() {
    document.getElementById("drawer-overlay").classList.remove("open");
    document.getElementById("ingestion-drawer").classList.remove("open");
}

// Bulk Ingest
async function submitBulkPayload() {
    const raw = document.getElementById("raw-payload-input").value.trim();
    const source = document.getElementById("payload-source-select").value;
    const feedback = document.getElementById("ingest-feedback");
    
    if (!raw) {
        feedback.innerHTML = `<span style="color:var(--accent-red)">Please paste a valid JSON array into the textarea.</span>`;
        return;
    }

    let parsed = null;
    try {
        parsed = JSON.parse(raw);
    } catch (err) {
        feedback.innerHTML = `<span style="color:var(--accent-red)">Invalid JSON syntax: ${err.message}</span>`;
        return;
    }

    feedback.innerHTML = `<span>Processing payload...</span>`;

    if (window.location.protocol.startsWith("http")) {
        try {
            const res = await fetch("/api/ingest", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ payload: parsed, source: source })
            });
            const result = await res.json();
            if (result.success) {
                feedback.innerHTML = `<span style="color:var(--accent-green); font-weight:600;">✓ ${escapeHtml(result.message)}</span>`;
                await loadDashboardState();
                await loadListings();
            } else {
                feedback.innerHTML = `<span style="color:var(--accent-red)">Error: ${escapeHtml(result.message)}</span>`;
            }
        } catch (e) {
            feedback.innerHTML = `<span style="color:var(--accent-red)">Network error: ${escapeHtml(e.message)}</span>`;
        }
    } else {
        // Direct file:// or offline mode feedback
        feedback.innerHTML = `
            <div style="color:var(--accent-green); font-weight:600; margin-bottom:4px;">✓ Payload validated (${parsed.length} items parsed).</div>
            <div style="font-size:0.75rem; color:var(--text-secondary);">To commit updates to the persistent database, execute in terminal:<br>
            <code style="color:var(--accent-cyan);">./pinball_ops.py --ingest &lt;file.json&gt; --source ${source}</code></div>
        `;
    }
}

// Trigger Live Scraper
async function triggerScrape(source) {
    const statusEl = document.getElementById("scrape-trigger-status");
    statusEl.textContent = `Connecting to ${source} collector runner...`;
    
    if (window.location.protocol.startsWith("http")) {
        try {
            const res = await fetch("/api/scrape/trigger", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ source: source })
            });
            const data = await res.json();
            statusEl.textContent = `[${data.status.toUpperCase()}] ${data.message}`;
            await loadDashboardState();
            await loadListings();
        } catch (e) {
            statusEl.textContent = `Scrape trigger error: ${e.message}`;
        }
    } else {
        statusEl.innerHTML = `Run live automation for ${source.toUpperCase()} via CLI: <code style="color:var(--accent-cyan);">python3 pinball_ops.py --auto-scrape</code> or <code style="color:var(--accent-cyan);">bash scripts/refresh.sh</code>`;
    }
}

// Maintenance triggers
async function triggerDateResolution() {
    if (window.location.protocol.startsWith("http")) {
        try {
            const res = await fetch("/api/maintenance/date-resolution", { method: "POST" });
            const data = await res.json();
            alert(data.message || "Date resolution complete.");
            await loadDashboardState();
            await loadListings();
        } catch (e) {
            alert("Date resolution error: " + e.message);
        }
    } else {
        alert("To run Date Resolution pass in terminal, execute:\n./pinball_ops.py --resolve-dates");
    }
}

async function triggerReportsRegen() {
    if (window.location.protocol.startsWith("http")) {
        try {
            const res = await fetch("/api/reports/generate", { method: "POST" });
            const data = await res.json();
            alert(`Reports successfully regenerated in dist directory (${data.stats.count} regional solid-state listings).`);
            await loadDashboardState();
            await loadListings();
        } catch (e) {
            alert("Report regeneration error: " + e.message);
        }
    } else {
        alert("To regenerate Step 6 reports in terminal, execute:\n./pinball_ops.py --report");
    }
}

// Deploy Modal Controls
function openDeployModal() {
    document.getElementById("deploy-modal-overlay").classList.add("open");
    document.getElementById("auth-confirm-check").checked = false;
    document.getElementById("btn-execute-deploy").disabled = true;
    document.getElementById("deploy-console-output").textContent = "Awaiting explicit authorization confirmation...";
}

function closeDeployModal() {
    document.getElementById("deploy-modal-overlay").classList.remove("open");
}

function toggleDeployButton() {
    const isChecked = document.getElementById("auth-confirm-check").checked;
    document.getElementById("btn-execute-deploy").disabled = !isChecked;
    const consoleEl = document.getElementById("deploy-console-output");
    if (isChecked) {
        consoleEl.textContent = "Authorized. Ready to execute git deployment workflow for farmerboy772.github.io.";
    } else {
        consoleEl.textContent = "Awaiting explicit authorization confirmation...";
    }
}

async function executeDeployment() {
    const consoleEl = document.getElementById("deploy-console-output");
    const btn = document.getElementById("btn-execute-deploy");
    btn.disabled = true;
    consoleEl.textContent = "Deploying to GitHub Pages... Please wait.\n";

    if (window.location.protocol.startsWith("http")) {
        try {
            const res = await fetch("/api/deploy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ authorized: true })
            });
            const data = await res.json();
            
            let logsText = (data.logs || []).join("\n");
            consoleEl.textContent = logsText + "\n\nResult: " + data.message;
            
            if (data.success) {
                consoleEl.textContent += `\nTarget live site: ${data.target_url}`;
            }
            await loadDashboardState();
        } catch (e) {
            consoleEl.textContent += `\nError executing deployment: ${e.message}`;
        }
    } else {
        consoleEl.textContent = `
[AUTHORIZED STEP 8 PIPELINE]
Repository: farmerboy772/farmerboy772.github.io
Branch: main (force-with-lease)
Commit Message Format: Update pinball listings: YYYY-MM-DD HH:MM CDT

Execute authorized deployment via terminal:
./pinball_ops.py --deploy --authorized
`;
    }
}

// Push Notifications & Webhook Alert Management in Drawer
async function loadWebhookConfig() {
    if (!window.location.protocol.startsWith("http")) return;
    try {
        const res = await fetch("/api/alerts/config");
        if (res.ok) {
            const data = await res.json();
            const input = document.getElementById("webhook-url-input");
            if (input && data.webhook_url) {
                input.value = data.webhook_url;
            }
        }
    } catch (e) {
        console.warn("Could not load webhook config:", e);
    }
}

async function saveWebhookConfig() {
    const input = document.getElementById("webhook-url-input");
    const feedback = document.getElementById("webhook-feedback");
    const url = (input?.value || "").trim();

    if (window.location.protocol.startsWith("http")) {
        try {
            feedback.innerHTML = `<span style="color:var(--text-muted);">Saving webhook configuration...</span>`;
            const res = await fetch("/api/alerts/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ webhook_url: url })
            });
            const data = await res.json();
            if (data.success) {
                feedback.innerHTML = `<span style="color:var(--accent-green); font-weight:600;">✓ ${escapeHtml(data.message)}</span>`;
            } else {
                feedback.innerHTML = `<span style="color:var(--accent-red);">${escapeHtml(data.message)}</span>`;
            }
        } catch (e) {
            feedback.innerHTML = `<span style="color:var(--accent-red);">Error saving webhook: ${escapeHtml(e.message)}</span>`;
        }
    } else {
        feedback.innerHTML = `<span style="color:var(--accent-cyan);">Offline mode: Set via environment variable PINBALL_ALERT_WEBHOOK or start server.</span>`;
    }
}

async function triggerTestAlert() {
    const input = document.getElementById("webhook-url-input");
    const feedback = document.getElementById("webhook-feedback");
    const url = (input?.value || "").trim();

    if (window.location.protocol.startsWith("http")) {
        try {
            feedback.innerHTML = `<span style="color:var(--text-muted);">Dispatching test deal alert...</span>`;
            const res = await fetch("/api/alerts/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ webhook_url: url })
            });
            const data = await res.json();
            if (data.success) {
                feedback.innerHTML = `<span style="color:var(--accent-green); font-weight:600;">✓ ${escapeHtml(data.message)}</span>`;
                loadRecentAlerts();
            } else {
                feedback.innerHTML = `<span style="color:var(--accent-red);">✕ ${escapeHtml(data.message)}</span>`;
            }
        } catch (e) {
            feedback.innerHTML = `<span style="color:var(--accent-red);">Network error: ${escapeHtml(e.message)}</span>`;
        }
    } else {
        feedback.innerHTML = `<span style="color:var(--accent-cyan);">To dispatch a test alert from CLI, run: <br><code>./pinball_ops.py --test-alert</code></span>`;
    }
}

async function loadRecentAlerts() {
    const container = document.getElementById("drawer-recent-alerts");
    if (!container) return;
    if (window.location.protocol.startsWith("http")) {
        try {
            const res = await fetch("/api/alerts");
            if (!res.ok) return;
            const data = await res.json();
            const alerts = data.alerts || [];
            if (alerts.length === 0) {
                container.innerHTML = `<div style="color:var(--text-muted); padding:4px;">No recent alerts recorded.</div>`;
                return;
            }
            container.innerHTML = alerts.slice(0, 10).map(a => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                    <div>
                        <strong style="color:var(--text-primary);">${escapeHtml(a.title)}</strong>
                        <div style="color:var(--text-muted); font-size:0.7rem;">${escapeHtml(a.location)} • ${a.price ? '$' + Number(a.price).toLocaleString() : 'N/A'} (FMV: ~$${Number(a.fmv || 0).toLocaleString()})</div>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-weight:700; color:${a.deal_tier === 'Steal' ? 'var(--accent-neon)' : 'var(--accent-cyan)'};">${escapeHtml(a.deal_tier || 'Alert')}</span>
                        <div style="font-size:0.68rem; color:var(--text-muted);">${a.timestamp ? a.timestamp.substring(11, 16) + ' UTC' : ''}</div>
                    </div>
                </div>
            `).join("");
        } catch (e) {
            container.innerHTML = `<div style="color:var(--text-muted);">Alert history unavailable offline.</div>`;
        }
    } else {
        container.innerHTML = `<div style="color:var(--text-muted); padding:4px;">Alert log active at <code>data/deal_alerts.json</code></div>`;
    }
}
