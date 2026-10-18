 * ==========================================================================
 * TOWER CONTROL // CORE SIMULATION CORE & AIRFRAME TARGET VECTOR ENGINE
 * SYSTEM MANAGEMENT SYSTEM & INTERFACE SYNCHRONIZATION PIPELINE
 * ==========================================================================
 */

// Operational Engine Velocity and Clock Framework Variables
let gameSpeed = 1;
let shiftTime = 0; 
let gameScore = 0;
let selectedFlightId = null;

// Primary Airframe Target State Array
let flights = [
  { id: 'AC102', airline: 'Northstar Air', type: 'A320', status: 'AIRBORNE', alt: 4200, hdg: 180, alert: false },
  { id: 'AC205', airline: 'Pacific Link', type: 'B737', status: 'GROUND', alt: 0, hdg: 90, alert: false },
  { id: 'AC318', airline: 'Northstar Air', type: 'A321', status: 'AIRBORNE', alt: 5800, hdg: 270, alert: false },
  { id: 'IN711', airline: 'Maple Regional', type: 'A220', status: 'HOLDING', alt: 3000, hdg: 45, alert: true }
];

// Continuous Fuel and Calculation Metrics Repository
let metrics = {
  fuelBurned: 1420,
  co2Emissions: 4473,
  efficiency: 98
};

// Main Window Frame Intervale Loop Hook
let simInterval = null;

/**
 * Main Application Framework Lifecycle Orchestrator
 */
document.addEventListener("DOMContentLoaded", () => {
  initializeInterfaceEvents();
  startSimulationEngine();
  renderTrafficMatrix();
  updateTelemetryDisplays();
  
  // Forces immediate resolution calibration layout check across graphics systems
  window.addEventListener('resize', renderCanvases);
});

/**
 * Event Interface Binding Registry
 */
function initializeInterfaceEvents() {
  // Sim Clock Rate Selector Modifier Link
  const speedSelector = document.getElementById("speed-select");
  if (speedSelector) {
    speedSelector.addEventListener("change", (e) => {
      gameSpeed = parseInt(e.target.value, 10) || 1;
      restartSimulationEngine();
    });
  }

  // System Documentation Modal Trigger Hook
  const btnRules = document.getElementById("btn-rules");
  if (btnRules) {
    btnRules.addEventListener("click", () => {
      const modal = document.getElementById("rules-dialog");
      if (modal) modal.showModal();
    });
  }

  // Pause Interceptor Action Handler Hook
  const btnPause = document.getElementById("btn-pause");
  if (btnPause) {
    btnPause.addEventListener("click", () => {
      if (simInterval) {
        clearInterval(simInterval);
        simInterval = null;
        btnPause.querySelector("span").textContent = "RESUME_SHIFT";
        btnPause.classList.add("active");
      } else {
        startSimulationEngine();
        btnPause.querySelector("span").textContent = "PAUSE_SHIFT";
        btnPause.classList.remove("active");
      }
    });
  }

  // Abort and Reset Command State Core Bindings
  const btnAbort = document.getElementById("btn-abort");
  if (btnAbort) {
    btnAbort.addEventListener("click", triggerShiftReportCompilation);
  }

  const btnRestart = document.getElementById("btn-restart-shift");
  if (btnRestart) {
    btnRestart.addEventListener("click", () => {
      location.reload();
    });
  }
}

/**
 * Operational Simulation State Loops
 */
function startSimulationEngine() {
  if (simInterval) clearInterval(simInterval);
  
  simInterval = setInterval(() => {
    // Process math parameters linearly based on clock tick speed properties
    shiftTime += gameSpeed;
    
    // Continuous random engine variables simulation update math rules
    metrics.fuelBurned += Math.floor(Math.random() * 3 + 1) * gameSpeed;
    metrics.co2Emissions = Math.floor(metrics.fuelBurned * 3.1514);
    
    // Balance efficiency based on outstanding active conflict alert counts
    const activeAlerts = flights.filter(f => f.alert).length;
    if (activeAlerts > 0 && shiftTime % 5 === 0) {
      metrics.efficiency = Math.max(70, metrics.efficiency - (activeAlerts * 1));
    }
    
    // Sync UI view strings
    updateTimerString();
    updateTelemetryDisplays();
    renderCanvases();
  }, 1000);
}

function restartSimulationEngine() {
  if (simInterval) {
    startSimulationEngine();
  }
}

/**
 * Clock Text Formatting String Pipelines
 */
function updateTimerString() {
  const timerDisplay = document.getElementById("shift-timer");
  if (!timerDisplay) return;

  let hrs = Math.floor(shiftTime / 3600).toString().padStart(2, '0');
  let mins = Math.floor((shiftTime % 3600) / 60).toString().padStart(2, '0');
  let secs = (shiftTime % 60).toString().padStart(2, '0');
  
  timerDisplay.textContent = `${hrs}:${mins}:${secs}`;
}

/**
 * Telemetry Element Vector Output Sync Pipeline
 */
function updateTelemetryDisplays() {
  const scoreNode = document.getElementById("score-display");
  if (scoreNode) scoreNode.textContent = gameScore.toString().padStart(4, '0');

  const fuelNode = document.getElementById("metric-fuel");
  if (fuelNode) fuelNode.textContent = `${metrics.fuelBurned.toLocaleString()} kg`;

  const co2Node = document.getElementById("metric-co2");
  if (co2Node) co2Node.textContent = `${metrics.co2Emissions.toLocaleString()} kg`;

  const effNode = document.getElementById("metric-efficiency");
  if (effNode) effNode.textContent = `${metrics.efficiency}%`;

  const countNode = document.getElementById("flight-count");
  if (countNode) countNode.textContent = `${flights.length.toString().padStart(2, '0')} TRACKED`;
}

/**
 * Monospace Flight Queue Table Renderer Matrix
 */
function renderTrafficMatrix() {
  const container = document.getElementById("traffic-list");
  if (!container) return;
  
  container.innerHTML = "";

  flights.forEach(flight => {
    const row = document.createElement("tr");
    
    // Set explicit status indicator layout state tags
    let classList = "traffic-row-item";
    if (flight.id === selectedFlightId) classList += " selected-target";
    if (flight.alert) classList += " alert-state";
    row.className = classList;
    
    row.innerHTML = `
      <td><span class="table-ident-callsign">${flight.id}</span></td>
      <td>${flight.airline} <span style="font-size: 9px; color: var(--text-dark-label)">(${flight.type})</span></td>
      <td>${flight.alt} FT / ${flight.hdg.toString().padStart(3, '0')}°</td>
      <td style="text-align: right;"><span class="status-tag ${flight.status.toLowerCase()}">${flight.status}</span></td>
    `;

    row.addEventListener("click", () => handleFlightTargetSelection(flight.id));
    container.appendChild(row);
  });
}

/**
 * Command Module Processor Core Logic
 */
function handleFlightTargetSelection(flightId) {
  selectedFlightId = flightId;
  renderTrafficMatrix();

  const flight = flights.find(f => f.id === flightId);
  const detailsCard = document.getElementById("selected-flight-summary");
  const actionGrid = document.getElementById("aircraft-actions");

  if (!detailsCard || !actionGrid) return;

  if (!flight) {
    detailsCard.className = "flight-data-card empty";
    detailsCard.textContent = "NO SELECTED VEHICLE AIRFRAME TARGET";
    actionGrid.innerHTML = "";
    return;
  }

  detailsCard.className = "flight-data-card";
  detailsCard.innerHTML = `
    <strong>TARGET: ${flight.id} // ${flight.airline}</strong><br>
    HEADING_VEC: ${flight.hdg.toString().padStart(3, '0')}° // STATUS_STATE: ${flight.status} // ALT: ${flight.alt} FT
  `;

  // Bind distinct industrial functional commands based on internal layout track positioning properties
  if (flight.status === 'AIRBORNE') {
    actionGrid.innerHTML = `
      <button class="btn btn-secondary" onclick="processExecutiveVectorCommand('HOLD')">ISSUE_HOLD_PATTERN</button>
      <button class="btn btn-primary" onclick="processExecutiveVectorCommand('LAND')">CLEAR_FOR_APPROACH</button>
    `;
  } else if (flight.status === 'HOLDING') {
    actionGrid.innerHTML = `
      <button class="btn btn-primary" onclick="processExecutiveVectorCommand('LAND')">CLEAR_FOR_APPROACH</button>
    `;
  } else {
    actionGrid.innerHTML = `
      <button class="btn btn-primary" onclick="processExecutiveVectorCommand('TAKEOFF')">CLEAR_FOR_DEPARTURE</button>
    `;
  }
}

/**
 * Command Matrix Logic Modifiers
 */
function processExecutiveVectorCommand(actionType) {
  const flight = flights.find(f => f.id === selectedFlightId);
  if (!flight) return;

  const safetyIndicator = document.getElementById("safety-banner");
  const safetyText = document.getElementById("safety-text");

  if (actionType === 'HOLD') {
    flight.status = 'HOLDING';
    flight.alt = 3000;
    gameScore += 50;
  } else if (actionType === 'LAND') {
    flight.status = 'GROUND';
    flight.alt = 0;
    flight.alert = false;
    gameScore += 150;
    
    // Clear display banner alarms if the critical conflicts are verified as resolved
    if (safetyIndicator && safetyText && !flights.some(f => f.alert)) {
      safetyIndicator.className = "safety-indicator nominal";
      safetyText.textContent = "AIRSPACE STATUS: NOMINAL // NO CONFLICTS";
    }
  } else if (actionType === 'TAKEOFF') {
    flight.status = 'AIRBORNE';
    flight.alt = 5000;
    gameScore += 100;
  }

  handleFlightTargetSelection(selectedFlightId);
  renderTrafficMatrix();
  updateTelemetryDisplays();
}

/**
 * Industrial Layout Graphics Rendering Engine Pipelines
 */
function renderCanvases() {
  // Runway View Port Painter Matrix - Fixed Perspective Geometry Rules
  const airportCanvas = document.getElementById("airport-view");
  if (airportCanvas) {
    const ctx = airportCanvas.getContext("2d");
    const container = airportCanvas.parentElement;
    
    // Dynamic canvas viewport alignment configuration adjustments
    if (airportCanvas.width !== container.clientWidth || airportCanvas.height !== container.clientHeight) {
      airportCanvas.width = container.clientWidth;
      airportCanvas.height = container.clientHeight;
    }
    
    ctx.clearRect(0, 0, airportCanvas.width, airportCanvas.height);
    
    const w = airportCanvas.width;
    const h = airportCanvas.height;
    const horizon = h * 0.4;

Use code with caution.
// Draw background landscape canvas field blocks cleanly
ctx.fillStyle = "#0c121a";
ctx.fillRect(0, horizon, w, h - horizon);
// Draw solid straight continuous runway strip matrices matching human engineering perspective parameters
ctx.fillStyle = "#161d26";
ctx.beginPath();
ctx.moveTo(w * 0.47, horizon);
ctx.lineTo(w * 0.53, horizon);
ctx.lineTo(w * 0.72, h);
ctx.lineTo(w * 0.28, h);
ctx.closePath();
ctx.fill();
// Draw outer boundary warning line arrays down the hardtop runway surface structure sides
ctx.strokeStyle = "#283545";
ctx.lineWidth = 1;
ctx.beginPath();
ctx.moveTo(w * 0.47, horizon); ctx.lineTo(w * 0.28, h);
ctx.moveTo(w * 0.53, horizon); ctx.lineTo(w * 0.72, h);
ctx.stroke();
// Draw crisp, structurally complete center-dashed navigation alignment marks down the landing path strip
ctx.strokeStyle = "#546678";
ctx.lineWidth = 2;
ctx.setLineDash([12, 18]);
ctx.beginPath();
ctx.moveTo(w * 0.5, horizon);
ctx.lineTo(w * 0.5, h);
ctx.stroke();
ctx.setLineDash([]);
}
// Circular Avionic Radar Array Sweep Logic Engine
const radarCanvas = document.getElementById("radar");
if (radarCanvas) {
const ctx = radarCanvas.getContext("2d");
const rect = radarCanvas.parentElement;
const size = Math.min(rect.clientWidth, rect.clientHeight) * 0.92;
if (radarCanvas.width !== size || radarCanvas.height !== size) {
radarCanvas.width = size;
radarCanvas.height = size;
}
ctx.clearRect(0, 0, radarCanvas.width, radarCanvas.height);
const cx = radarCanvas.width / 2;
const cy = radarCanvas.height / 2;
const radius = radarCanvas.width / 2;
// Render underlying low-noise concentric targeting vectors radar rings rings
ctx.strokeStyle = "#121b24";
ctx.lineWidth = 1;
ctx.beginPath(); ctx.arc(cx, cy, radius * 0.35, 0, Math.PI * 2); ctx.stroke();
ctx.beginPath(); ctx.arc(cx, cy, radius * 0.70, 0, Math.PI * 2); ctx.stroke();
// Render diagnostic cross-azimuth bearing line arrays
ctx.strokeStyle = "#0e151c";
ctx.beginPath();
ctx.moveTo(cx, 0); ctx.lineTo(cx, radarCanvas.height);
ctx.moveTo(0, cy); ctx.lineTo(radarCanvas.width, cy);
ctx.stroke();
// Plot real-time flying aircraft target signatures across tracking grid vectors vectors
flights.forEach((flight, i) => {
// Avoid tracking coordinates calculations if target data is confirmed parked down on gate ground grids
if (flight.status === 'GROUND') return;
const angle = (flight.hdg * Math.PI) / 180;
const dist = radius * (0.28 + (i * 0.16));
const bx = cx + Math.sin(angle) * dist;
const by = cy - Math.cos(angle) * dist;
// Color target signatures using strict operational system logic states variables rules
ctx.fillStyle = flight.alert ? "#ffb300" : "#00b0ff";
ctx.beginPath();
ctx.arc(bx, by, 4, 0, Math.PI * 2);
ctx.fill();
// Draw vector heading tail indicators to convey flight tracking velocity directional states
ctx.strokeStyle = flight.alert ? "rgba(255, 179, 0, 0.4)" : "rgba(0, 176, 255, 0.3)";
ctx.lineWidth = 1.5;
ctx.beginPath();
ctx.moveTo(bx, by);
ctx.lineTo(bx + Math.sin(angle) * 15, by - Math.cos(angle) * 15);
ctx.stroke();
// Bind tracking index alphanumeric identity call signs adjacent to coordinates dots signatures
ctx.fillStyle = "#8598a6";
ctx.font = "bold 9px 'JetBrains Mono', monospace";
ctx.fillText(flight.id, bx + 8, by + 3);
});
}
}
/**
• Operational Shift Performance Debrief Data Struct Compilation Generator
*/
function triggerShiftReportCompilation() {
if (simInterval) clearInterval(simInterval);
const content = document.getElementById("results-content");
if (content) {
content.innerHTML = <div class="report-cell"><span>TOTAL_TIME_ELAPSED</span><strong>${shiftTime} SEC</strong></div> <div class="report-cell"><span>TOTAL_OPERATIONAL_SCORE</span><strong>${gameScore} PTS</strong></div> <div class="report-cell"><span>TOTAL_FUEL_EXPENDED</span><strong>${metrics.fuelBurned.toLocaleString()} KG</strong></div> <div class="report-cell"><span>CO2_ENVIRONMENTAL_IMPACT</span><strong>${metrics.co2Emissions.toLocaleString()} KG</strong></div>;
}
const reportModal = document.getElementById("results-dialog");
if (reportModal) reportModal.showModal();
}
