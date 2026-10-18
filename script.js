(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const canvas = $("radar");
  const context = canvas.getContext("2d");
  const airportCanvas = $("airport-view");
  const airportContext = airportCanvas.getContext("2d");
  const HORIZON_SECONDS = 8 * 60;
  const HORIZONTAL_LIMIT_NM = 5;
  const VERTICAL_LIMIT_FT = 1000;
  const COLLISION_LIMIT_NM = 0.15;
  const COLLISION_VERTICAL_FT = 500;
  const TAXI_DURATION_SECONDS = 240;
  const TAKEOFF_DURATION_SECONDS = 18;
  const RUNWAY_OCCUPANCY_SECONDS = 30;
  const TAXI_IN_SECONDS = 100;
  const MAX_LOCAL_AIRCRAFT = 4;
  const EMERGENCY_RESPONSE_MS = 10000;
  const FUEL_KG_PER_NM = 8;
  const CO2_KG_PER_KG_FUEL = 3.16;
  const MAP = { minX: -45, maxX: 45, minY: -32, maxY: 32 };
  let airportLighting = "day";
  let radarRangeNm = 40;
  const WAYPOINTS = {
    ALPHA: { x: -7, y: 2 },
    BRAVO: { x: 7, y: 3 },
    CHARLIE: { x: 0, y: 11 },
    DELTA: { x: 2, y: -9 },
    ECHO: { x: -17, y: 13 },
    FOXTROT: { x: 19, y: -13 }
  };
  const WAYPOINT_LABELS = {
    ALPHA: "NORTH FIX",
    BRAVO: "EAST FIX",
    CHARLIE: "NORTH FIX",
    DELTA: "SOUTH FIX",
    ECHO: "WEST FIX",
    FOXTROT: "EAST FIX"
  };
  const DESTINATIONS = {
    NORTH: { x: 36, y: 22 },
    UP: { x: 0, y: 37 },
    SOUTH: { x: -36, y: 22 },
    EAST: { x: 37, y: 0 },
    WEST: { x: -37, y: 0 },
    TORONTO: { x: 53, y: 18 },
    TORONTOPEARSON: { x: 53, y: 18 },
    VANCOUVER: { x: -59, y: 9 },
    NEWYORK: { x: 51, y: -12 },
    LONDON: { x: 68, y: 19 },
    LONDONHEATHROW: { x: 68, y: 19 },
    TOKYO: { x: -72, y: -17 },
    TOKYOHANEDA: { x: -72, y: -17 },
    PARIS: { x: 70, y: 6 },
    PARISCHARLESDEGAULLE: { x: 70, y: 6 }
  };
  const DESTINATION_LABELS = {
    TORONTO: "TORONTO PEARSON", TORONTOPEARSON: "TORONTO PEARSON",
    NEWYORK: "NEW YORK", LONDON: "LONDON HEATHROW", LONDONHEATHROW: "LONDON HEATHROW",
    TOKYO: "TOKYO HANEDA", TOKYOHANEDA: "TOKYO HANEDA",
    PARIS: "PARIS CHARLES DE GAULLE", PARISCHARLESDEGAULLE: "PARIS CHARLES DE GAULLE",
    VANCOUVER: "VANCOUVER"
  };
  const AIRPORT_POINT = { x: 0, y: -11 };
  const RUNWAY_POINT = AIRPORT_POINT;
  const RUNWAY_COOLDOWN_MS = 20_000;

const RUNWAYS = [
  { id: "09", x: -2.5, y: -11, heading: 90, screenX: 0.24 },
  { id: "18", x: 0, y: -11, heading: 0, screenX: 0.50 },
  { id: "27", x: 2.5, y: -11, heading: 270, screenX: 0.76 }
];

const runwayAvailableAt = new Map(
  RUNWAYS.map((runway) => [runway.id, 0])
);
  
  const SHIFT_DEPARTURES = [
    { id: "AC102", gate: -16, route: ["ALPHA", "NEWYORK"], altitude: 18000, speed: 240, airline: "Northstar Air", type: "A320", origin: "HOME" },
    { id: "AC205", gate: 16, route: ["BRAVO", "VANCOUVER"], altitude: 18000, speed: 240, airline: "Pacific Link", type: "B737", origin: "HOME" },
    { id: "AC318", gate: -8, route: ["CHARLIE", "LONDON"], altitude: 22000, speed: 220, airline: "Northstar Air", type: "A321", origin: "HOME" },
    { id: "AC427", gate: 8, route: ["DELTA", "PARIS"], altitude: 20000, speed: 230, airline: "Maple Regional", type: "E190", origin: "HOME" },
    { id: "AC536", gate: -23, route: ["BRAVO", "TORONTO"], altitude: 18000, speed: 245, airline: "Maple Regional", type: "A220", origin: "HOME" },
    { id: "AC641", gate: 23, route: ["ALPHA", "TOKYO"], altitude: 24000, speed: 215, airline: "Pacific Link", type: "B787", origin: "HOME" }
  ];
  const SHIFT_ARRIVALS = [
    { id: "IN711", x: -3, y: 29, heading: 180, altitude: 9000, speed: 180, route: ["ALPHA"], airline: "Maple Regional", type: "A220", origin: "TORONTO" },
    { id: "IN824", x: 30, y: 6, heading: 270, altitude: 8000, speed: 175, route: ["BRAVO"], airline: "Northstar Air", type: "A320", origin: "NEW YORK" },
    { id: "IN936", x: -30, y: 12, heading: 110, altitude: 10000, speed: 190, route: ["ECHO"], airline: "Pacific Link", type: "B737", origin: "VANCOUVER" }
  ];
  const TUTORIAL_STEPS = [
    { selector: null, title: "Your shift", text: "Manage flights using the controls. Critical emergencies require a typed command." },
    { selector: '[data-tutorial="radar"]', title: "Read the radar", text: "Select aircraft on the radar. Follow routes and watch for conflicts." },
    { selector: '[data-tutorial="traffic"]', title: "Manage up to four aircraft", text: "Select a flight to view its status. Maximum 4 aircraft at once." },
    { selector: '[data-tutorial="flight-actions"]', title: "Control flights with buttons", text: "Select a flight and choose an available action. Check runway and weather conditions." },
    { selector: '[data-tutorial="weather"]', title: "Weather and emergencies", text: "Monitor wind, rain, fog and storms. Critical emergencies pause traffic for 10 seconds." },
    { selector: '[data-tutorial="sustainability"]', title: "Sustainability and routes", text: "View estimated distance, fuel and CO₂. Safety comes first." },
    { selector: ".score-counter", title: "Scoring", text: "Earn points for safe play, completed flights, resolved emergencies and safe route improvements." }
  ];
  const state = {
    aircraft: [],
    completedFlights: [],
    selectedId: null,
    simTime: 0,
    airportTime: 0,
    realTime: 0,
    speed: 30,
    paused: false,
    finished: false,
    conflicts: [],
    resolvedPairs: new Set(),
    history: [],
    departures: 0,
    arrivals: 0,
    emergencyAttempts: 0,
    emergencyCommandMatches: 0,
    delaySeconds: 0,
    conflictEvents: 0,
    runwayEvents: 0,
    score: 0,
    scoreTimeRemainder: 0,
    safeDepartures: 0,
    safeArrivals: 0,
    emergenciesResolved: 0,
    emergenciesFailed: 0,
    collisions: 0,
    aircraftLost: 0,
    routeDecisions: 0,
    efficientRoutes: 0,
    endReason: "",
    scheduledIndex: 0,
    nextTaxiQueueOrder: 0,
    nextTrafficAt: 110,
    activeConflictKeys: new Set(),
    commandConflictSnapshot: new Set(),
    reportOpen: false,
    gameOver: null,
    weather: { condition: "CLEAR", direction: 270, speed: 0, visibility: 10, warning: "No active weather advisories." },
    weatherEmergency: null,
    departuresPaused: false,
    emergencyKeys: new Set(),
    lastCommand: "",
    shiftStartDistance: 0,
    lastFrame: 0,
    lastUiUpdate: 0
  };
  let tutorialIndex = -1;
  let tutorialWasPaused = false;
  let tutorialTarget = null;

  function flight(id, x, y, heading, altitude, speed, waypoint, destination) {
    const destinationPoint = destination && (WAYPOINTS[destination] || DESTINATIONS[destination])
      ? { name: destination, ...(WAYPOINTS[destination] || DESTINATIONS[destination]) }
      : { name: waypoint, ...WAYPOINTS[waypoint] };
    const firstPoint = WAYPOINTS[waypoint];
    return {
      id, x, y, heading, altitude, targetAltitude: altitude, speed,
      origin: "SECTOR", destinationName: destinationPoint.name,
      airline: "Training Air", aircraftType: "A320",
      route: [...(firstPoint ? [{ name: waypoint, ...firstPoint }] : []), destinationPoint],
      routeIndex: 0, cleared: false, arrived: false, holdHeading: null, stage: "airborne",
      holdUntil: 0, flownNm: 0, enteredRestrictedArea: false, routeImproved: false,
      delaySeconds: 0, taxiElapsed: 0, runwayRemaining: 0, trail: []
    };
  }

  function createDeparture(template) {
    const item = flight(template.id, template.gate, 7, 0, template.altitude, template.speed, template.route[0], template.route[1]);
    item.stage = "gate";
    item.departure = true;
    item.cleared = false;
    item.gateX = template.gate;
    item.cruiseAltitude = template.altitude;
    item.altitude = 0;
    item.targetAltitude = 0;
    item.airline = template.airline;
    item.aircraftType = template.type;
    item.origin = template.origin;
    item.route = template.route.map((name) => ({ name, ...(WAYPOINTS[name] || DESTINATIONS[name]) }));
    item.destinationName = destinationLabel(template.route.at(-1));
    return item;
  }

  function createArrival(template) {
    const approachFix = WAYPOINTS[template.route[0]];
    const item = flight(template.id, template.x, template.y, template.heading, template.altitude, template.speed, template.route[0], "SOUTH");
    item.stage = "holding";
    item.departure = false;
    item.cleared = false;
    item.route = [{ name: template.route[0], ...approachFix }, { name: "RUNWAY 09", ...RUNWAY_POINT }];
    item.routeIndex = 0;
    item.targetAltitude = 600;
    item.approachFix = template.route[0];
    item.airline = template.airline;
    item.aircraftType = template.type;
    item.origin = template.origin;
    item.destinationName = "HOME AIRPORT";
    return item;
  }

  function destinationLabel(name) {
    const key = String(name).toUpperCase().replace(/\s+/g, "");
    return DESTINATION_LABELS[key] || key;
  }

  const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const pairKey = (a, b) => [a.id, b.id].sort().join("/");
  const formatClock = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    return `${String(minutes).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  };
  const bearing = (a, b) => (Math.atan2(b.x - a.x, b.y - a.y) * 180 / Math.PI + 360) % 360;

  function currentTarget(aircraft) {
    return aircraft.route[aircraft.routeIndex] || null;
  }

  function updateWeather() {
    const cycle = Math.floor(state.simTime / 300) % 5;
    const conditions = [
      { condition: "CLEAR", direction: 270, speed: 0, visibility: 10, warning: "No active weather advisories." },
      { condition: "CROSSWIND", direction: 240, speed: 22, visibility: 10, warning: "Crosswind is affecting runway approach and ground speed." },
      { condition: "RAIN", direction: 260, speed: 14, visibility: 4, warning: "Rain is reducing visibility; arrival spacing may take longer." },
      { condition: "FOG", direction: 270, speed: 3, visibility: 1.5, warning: "Fog is reducing visibility near the airport." },
      { condition: "THUNDERSTORM", direction: 230, speed: 28, visibility: 2, warning: "Thunderstorms nearby. The marked radar area is unsafe for flight." }
    ];
    state.weather = { ...conditions[cycle] };
    if (state.weather.condition === "THUNDERSTORM") {
      state.weather.hazard = {
        x: -10 + 20 * Math.sin(state.simTime / 115),
        y: 4 + 5 * Math.cos(state.simTime / 145),
        radius: 8
      };
    } else {
      state.weather.hazard = null;
    }
  }

  function updateWeatherEmergency() {
    if (state.weatherEmergency) {
      updateEmergencyCountdown();
      return;
    }
    if (state.paused || state.finished) return;

    if (state.weather.condition === "THUNDERSTORM") {
      const endangered = state.aircraft.find(aircraftWeatherRisk);
      if (endangered) {
        const key = `weather:${Math.floor(state.simTime / 1500)}:${endangered.id}`;
        if (!state.emergencyKeys.has(key) && findWeatherReroute(endangered)) {
          state.emergencyKeys.add(key);
          beginEmergency({
            type: "DANGEROUS STORM",
            kind: "weather",
            targetIds: [endangered.id],
            requiredCommand: `REROUTE ${endangered.id}`,
            explanation: `${endangered.id} is projected to enter the storm area. Rerouting changes its flight path around the marked radar hazard.`
          });
          return;
        }
      }
    }

    const urgent = [...state.conflicts]
      .filter((pair) => (pair.kind === "airspace" && pair.seconds <= 60) ||
        (pair.kind === "runway" && pair.horizontalNm <= 1 && [pair.first.stage, pair.second.stage].includes("taxi")))
      .sort((a, b) => a.seconds - b.seconds)[0];
    if (!urgent) return;
    const key = `${urgent.kind}:${pairKey(urgent.first, urgent.second)}`;
    if (state.emergencyKeys.has(key)) return;

    const requiredCommand = urgent.kind === "runway"
      ? `HOLD ${urgent.first.stage === "taxi" ? urgent.first.id : urgent.second.id}`
      : findConflictReroute(urgent);
    if (!requiredCommand) return;
    state.emergencyKeys.add(key);
    beginEmergency({
      type: urgent.kind === "runway" ? "RUNWAY CONFLICT" : "CRITICAL AIRCRAFT CONFLICT",
      kind: "conflict",
      targetIds: [urgent.first.id, urgent.second.id],
      pairKey: key,
      requiredCommand,
      explanation: urgent.kind === "runway"
        ? `${urgent.first.id} and ${urgent.second.id} are competing for the runway. Holding the taxiing aircraft prevents them entering the same runway space.`
        : `${urgent.first.id} and ${urgent.second.id} are projected to pass ${urgent.horizontalNm.toFixed(1)} NM apart in about ${Math.max(1, Math.round(urgent.seconds / 60))} minute(s). Rerouting one aircraft can change their predicted paths.`
    });
  }

  function beginEmergency(emergency) {
    emergency.deadline = performance.now() + EMERGENCY_RESPONSE_MS;
    emergency.wasPaused = state.paused;
    state.weatherEmergency = emergency;
    state.paused = true;
    if ($("results-dialog").open) {
      $("results-dialog").close();
      state.reportOpen = false;
    }
    if ($("rules-dialog").open) $("rules-dialog").close();
    $("emergency-command-input").value = "";
    $("emergency-required-command").textContent = emergency.requiredCommand;
    $("emergency-feedback").textContent = "";
    $("emergency-title").textContent = emergency.type;
    $("emergency-message").textContent = emergency.explanation;
    $("emergency-alert").hidden = false;
    setMessage(`${emergency.type}. Simulation paused for a 10-second response.`, "warning");
    renderUI();
    drawRadar();
    $("emergency-command-input").focus();
  }

  function updateEmergencyCountdown() {
    const emergency = state.weatherEmergency;
    if (!emergency) return;
    const remainingMs = emergency.deadline - performance.now();
    if (remainingMs > 0) {
      $("emergency-clock").textContent = `${(remainingMs / 1000).toFixed(1)}s`;
      return;
    }
    state.emergenciesFailed += 1;
    endShift(null, `${emergency.type} timed out without a successful response.`);
  }

  function proposedRoute(plane, waypointName) {
    const destination = plane.route.at(-1);
    if (!destination || !WAYPOINTS[waypointName]) return null;
    return [{ name: waypointName, ...WAYPOINTS[waypointName] }, destination];
  }

  function findWeatherReroute(plane) {
    if (!["airborne", "approach"].includes(plane.stage) || !state.weather.hazard) return null;
    const originalRoute = plane.route;
    const originalIndex = plane.routeIndex;
    for (const waypointName of Object.keys(WAYPOINTS)) {
      const route = proposedRoute(plane, waypointName);
      if (!route) continue;
      plane.route = route;
      plane.routeIndex = 0;
      const safe = !aircraftWeatherRisk(plane);
      if (safe) {
        plane.route = originalRoute;
        plane.routeIndex = originalIndex;
        return waypointName;
      }
    }
    plane.route = originalRoute;
    plane.routeIndex = originalIndex;
    return null;
  }

  function findConflictReroute(pair) {
    for (const plane of [pair.first, pair.second]) {
      if (findConflictWaypoint(plane, pair)) return `REROUTE ${plane.id}`;
    }
    return "";
  }

  function findConflictWaypoint(plane, pair) {
    if (!["airborne", "approach"].includes(plane.stage)) return null;
    const originalRoute = plane.route;
    const originalIndex = plane.routeIndex;
    for (const waypointName of Object.keys(WAYPOINTS)) {
      const route = proposedRoute(plane, waypointName);
      if (!route) continue;
      plane.route = route;
      plane.routeIndex = 0;
      const resolved = !predictPair(pair.first, pair.second).conflict;
      plane.route = originalRoute;
      plane.routeIndex = originalIndex;
      if (resolved) return waypointName;
    }
    return null;
  }

  function aircraftWeatherRisk(plane) {
    if (!state.weather.hazard || !["airborne", "approach"].includes(plane.stage)) return false;
    for (const seconds of [0, 45, 90, 150]) {
      const point = futurePosition(plane, seconds);
      if (distance(point, state.weather.hazard) <= state.weather.hazard.radius + 2) return true;
    }
    return false;
  }

  function groundSpeedFor(heading, airspeed) {
    const wind = state.weather;
    const downwindHeading = (wind.direction + 180) % 360;
    const relativeAngle = (heading - downwindHeading) * Math.PI / 180;
    const tailwind = Math.cos(relativeAngle) * wind.speed;
    return Math.max(airspeed * 0.65, Math.min(airspeed * 1.25, airspeed + tailwind));
  }

  function futurePosition(aircraft, seconds) {
    const target = currentTarget(aircraft);
    const heading = aircraft.holdHeading !== null && state.simTime + seconds < aircraft.holdUntil
      ? aircraft.holdHeading
      : target ? bearing(aircraft, target) : aircraft.heading;
    const moving = aircraft.stage === "airborne" || aircraft.stage === "approach";
    const speed = moving && !aircraft.arrived ? groundSpeedFor(heading, aircraft.speed) : 0;
    const radians = heading * Math.PI / 180;
    const x = aircraft.x + (moving ? Math.sin(radians) * speed * seconds / 3600 : 0);
    const y = aircraft.y + (moving ? Math.cos(radians) * speed * seconds / 3600 : 0);
    const altitudeDifference = aircraft.targetAltitude - aircraft.altitude;
    const altitude = aircraft.altitude + (moving
      ? Math.sign(altitudeDifference) * Math.min(Math.abs(altitudeDifference), 1800 * seconds / 60)
      : 0);
    return { x, y, altitude, vx: moving ? Math.sin(radians) * speed / 3600 : 0, vy: moving ? Math.cos(radians) * speed / 3600 : 0 };
  }

  function predictPair(first, second) {
    // Project current ground tracks at constant velocity over the demo horizon; this is not operational separation analysis.
    const a = futurePosition(first, 0);
    const b = futurePosition(second, 0);
    const relativeX = a.x - b.x;
    const relativeY = a.y - b.y;
    const relativeVx = a.vx - b.vx;
    const relativeVy = a.vy - b.vy;
    const velocitySquared = relativeVx ** 2 + relativeVy ** 2;
    const closestSeconds = velocitySquared === 0
      ? 0
      : Math.max(0, Math.min(HORIZON_SECONDS, -(relativeX * relativeVx + relativeY * relativeVy) / velocitySquared));
    const firstAtClosest = futurePosition(first, closestSeconds);
    const secondAtClosest = futurePosition(second, closestSeconds);
    const horizontalNm = Math.hypot(firstAtClosest.x - secondAtClosest.x, firstAtClosest.y - secondAtClosest.y);
    const verticalFt = Math.abs(firstAtClosest.altitude - secondAtClosest.altitude);
    return {
      first, second, seconds: closestSeconds, horizontalNm, verticalFt,
      conflict: horizontalNm < HORIZONTAL_LIMIT_NM && verticalFt < VERTICAL_LIMIT_FT,
      kind: "airspace"
    };
  }

  function analyzeConflicts() {
    const pairs = [];
    for (let i = 0; i < state.aircraft.length; i += 1) {
      for (let j = i + 1; j < state.aircraft.length; j += 1) {
        const first = state.aircraft[i];
        const second = state.aircraft[j];
        const prediction = predictPair(first, second);
        if (prediction.conflict && ["airborne", "approach"].includes(first.stage) &&
            ["airborne", "approach"].includes(second.stage)) pairs.push(prediction);
        const runwayPair = predictRunwayPair(first, second);
        if (runwayPair) pairs.push(runwayPair);
      }
    }
    const nowKeys = new Set(pairs.map((pair) => `${pair.kind}:${pairKey(pair.first, pair.second)}`));
    for (const key of nowKeys) {
      if (!state.activeConflictKeys.has(key)) {
        state.conflictEvents += 1;
        if (key.startsWith("runway:")) state.runwayEvents += 1;
      }
    }
    for (const key of state.activeConflictKeys) {
      if (!nowKeys.has(key)) {
        state.resolvedPairs.add(key);
      }
    }
    state.activeConflictKeys = nowKeys;
    state.conflicts = pairs;
    return pairs;
  }

  function predictRunwayPair(first, second) {
    const firstApproaching = first.stage === "approach" && distance(first, RUNWAY_POINT) < 3;
    const secondApproaching = second.stage === "approach" && distance(second, RUNWAY_POINT) < 3;
    const firstTaxiEta = TAXI_DURATION_SECONDS - first.taxiElapsed;
    const secondTaxiEta = TAXI_DURATION_SECONDS - second.taxiElapsed;
    const bothTaxi = first.stage === "taxi" && second.stage === "taxi" &&
      Math.abs(firstTaxiEta - secondTaxiEta) <= RUNWAY_OCCUPANCY_SECONDS;
    const sharedRunway = first.stage === "runway" && second.stage === "runway";
    const firstTaxiOverlapsRunway = first.stage === "taxi" && second.stage === "runway" &&
      firstTaxiEta <= second.runwayRemaining;
    const secondTaxiOverlapsRunway = second.stage === "taxi" && first.stage === "runway" &&
      secondTaxiEta <= first.runwayRemaining;
    const runwayAndArrival = (first.stage === "runway" && secondApproaching) ||
      (second.stage === "runway" && firstApproaching);
    const taxiAndArrival = (first.stage === "taxi" && secondApproaching && firstTaxiEta <= RUNWAY_OCCUPANCY_SECONDS) ||
      (second.stage === "taxi" && firstApproaching && secondTaxiEta <= RUNWAY_OCCUPANCY_SECONDS);
    const bothApproaching = firstApproaching && secondApproaching;
    if (!(bothTaxi || sharedRunway || firstTaxiOverlapsRunway || secondTaxiOverlapsRunway ||
        runwayAndArrival || taxiAndArrival || bothApproaching)) return null;
    return {
      first, second, seconds: 0, horizontalNm: distance(first, second),
      verticalFt: Math.abs(first.altitude - second.altitude),
      conflict: true, kind: "runway"
    };
  }

  function detectCollision() {
    const airborneStages = new Set(["airborne", "approach"]);
    const runwayStages = new Set(["taxi", "taxi-hold", "taxi-safety-hold", "runway", "takeoff", "landing", "taxi-in"]);
    for (let i = 0; i < state.aircraft.length; i += 1) {
      for (let j = i + 1; j < state.aircraft.length; j += 1) {
        const first = state.aircraft[i];
        const second = state.aircraft[j];
        const horizontalNm = distance(first, second);
        const verticalFt = Math.abs(first.altitude - second.altitude);
        if (airborneStages.has(first.stage) && airborneStages.has(second.stage) &&
            horizontalNm <= COLLISION_LIMIT_NM && verticalFt <= COLLISION_VERTICAL_FT) {
          return { first, second, horizontalNm, verticalFt, cause: "Their simulated flight paths intersected with insufficient modeled separation." };
        }
        if (runwayStages.has(first.stage) && runwayStages.has(second.stage) &&
            horizontalNm <= COLLISION_LIMIT_NM) {
          const runwayUse = ["runway", "landing"].includes(first.stage) ||
            ["runway", "landing"].includes(second.stage);
          return {
            first, second, horizontalNm, verticalFt,
            cause: runwayUse
              ? "Their simulated ground movements overlapped on the shared runway."
              : "Their simulated ground paths intersected with insufficient spacing."
          };
        }
      }
    }
    return null;
  }

  function remainingRouteNm(aircraft) {
    let total = 0;
    let from = aircraft;
    for (let i = aircraft.routeIndex; i < aircraft.route.length; i += 1) {
      total += distance(from, aircraft.route[i]);
      from = aircraft.route[i];
    }
    return total;
  }

  function awardPoints(points) {
    state.score += points;
    $("shift-score").textContent = String(state.score);
  }

  function isSafeFlightEvent(plane) {
    if (aircraftWeatherRisk(plane)) return false;
    return !state.aircraft.some((other) => {
      if (other === plane) return false;
      if (["airborne", "approach"].includes(plane.stage) &&
          ["airborne", "approach"].includes(other.stage) &&
          predictPair(plane, other).conflict) return true;
      return Boolean(predictRunwayPair(plane, other));
    });
  }

  function directRouteCandidate(plane) {
    if (!plane.departure || plane.stage !== "airborne" ||
        plane.route.length - plane.routeIndex < 2) return null;
    const destination = plane.route.at(-1);
    if (!destination) return null;
    const previousRoute = plane.route;
    const previousIndex = plane.routeIndex;
    const previousDistance = remainingRouteNm(plane);
    const route = [{ ...destination }];
    plane.route = route;
    plane.routeIndex = 0;
    const proposedDistance = remainingRouteNm(plane);
    let safe = proposedDistance < previousDistance && !aircraftWeatherRisk(plane);
    if (safe) {
      safe = state.aircraft.every((other) => {
        if (other === plane || !["airborne", "approach"].includes(other.stage)) return true;
        plane.route = route;
        plane.routeIndex = 0;
        const proposedPrediction = predictPair(plane, other);
        return !proposedPrediction.conflict;
      });
    }
    plane.route = previousRoute;
    plane.routeIndex = previousIndex;
    return safe ? { route, distanceNm: proposedDistance, previousDistance } : null;
  }

  function applyEfficientRoute(plane) {
    if (state.paused || state.finished || !state.aircraft.includes(plane)) return;
    const candidate = directRouteCandidate(plane);
    if (!candidate) {
      setMessage("That shortcut is no longer safe or shorter. The filed route remains unchanged.", "warning");
      return;
    }
    state.routeDecisions += 1;
    plane.route = candidate.route;
    plane.routeIndex = 0;
    state.efficientRoutes += 1;
    plane.routeImproved = true;
    awardPoints(15);
    setMessage(`${plane.id} is now routed directly to ${plane.destinationName}; estimated remaining distance reduced by ${(candidate.previousDistance - candidate.distanceNm).toFixed(1)} NM.`, "success");
    analyzeConflicts();
    renderUI();
    drawRadar();
  }

  function metrics() {
    // One fixed factor is applied to flown plus planned distance for a comparable educational estimate.
    const distanceNm = [...state.completedFlights, ...state.aircraft]
      .reduce((total, plane) => total + plane.flownNm + remainingRouteNm(plane), 0);
    const fuelKg = distanceNm * FUEL_KG_PER_NM;
    return { distanceNm, fuelKg, co2Kg: fuelKg * CO2_KG_PER_KG_FUEL };
  }

  function setMessage(text, kind = "") {
    const feedback = $("action-feedback");
    feedback.textContent = text;
    feedback.classList.toggle("error", kind === "error");
    feedback.classList.toggle("success", kind === "success");
    $("live-message").textContent = text;
  }

  function selectAircraft(id) {
    if (!state.aircraft.some((plane) => plane.id === id)) return;
    state.selectedId = id;
    renderUI();
  }
let crashCutsceneTimer = null;

function resetShift() {
    if (crashCutsceneTimer !== null) {
      clearTimeout(crashCutsceneTimer);
      crashCutsceneTimer = null;
    }

    const crashCutscene = $("crash-cutscene");
    crashCutscene.hidden = true;
    crashCutscene.setAttribute("aria-hidden", "true");
    crashCutscene.classList.remove("playing");

    state.aircraft = [
  createDeparture(SHIFT_DEPARTURES[0]),
  createDeparture(SHIFT_DEPARTURES[1]),
  createDeparture(SHIFT_DEPARTURES[2]),
  createDeparture(SHIFT_DEPARTURES[3])
];

state.completedFlights = [];
    state.selectedId = state.aircraft[0]?.id ?? null;
    state.simTime = 0;
  RUNWAYS.forEach((runway) => runwayAvailableAt.set(runway.id, 0));
    state.airportTime = 0;
    state.realTime = 0;
    state.lastFrame = 0;
    state.lastUiUpdate = 0;
    state.speed = 30;
    state.paused = false;
    state.finished = false;
    state.gameOver = null;
    state.resolvedPairs = new Set();
    state.activeConflictKeys = new Set();
    state.emergencyKeys = new Set();
    state.departures = 0;
    state.arrivals = 0;
    state.emergencyAttempts = 0;
    state.emergencyCommandMatches = 0;
    state.score = 0;
    state.scoreTimeRemainder = 0;
    state.safeDepartures = 0;
    state.safeArrivals = 0;
    state.emergenciesResolved = 0;
    state.emergenciesFailed = 0;
    state.collisions = 0;
    state.aircraftLost = 0;
    state.routeDecisions = 0;
    state.efficientRoutes = 0;
    state.endReason = "";
    state.delaySeconds = 0;
    state.conflictEvents = 0;
    state.runwayEvents = 0;
    state.departuresPaused = false;
    state.scheduledIndex = 0;
    state.nextTaxiQueueOrder = 0;
    state.nextTrafficAt = 110;
    state.reportOpen = false;
    state.weather = { condition: "CLEAR", direction: 270, speed: 0, visibility: 10, warning: "No active weather advisories." };
    state.weatherEmergency = null;
    state.paused = false;
    $("emergency-alert").hidden = true;
    $("emergency-command-input").value = "";
    $("emergency-feedback").textContent = "";
    $("emergency-clock").textContent = "10.0s";
    state.lastCommand = "";
    radarRangeNm = 40;
    state.commandConflictSnapshot = new Set();
    state.conflicts = [];
    analyzeConflicts();
    state.shiftStartDistance = metrics().distanceNm;
    updateWeather();
    $("speed-select").value = "30";
    $("radar-range").value = "40";
    $("time-of-day").value = "day";
    airportLighting = "day";
    $("pause-button").textContent = "Pause";
    $("pause-button").disabled = false;
    $("pause-button").setAttribute("aria-pressed", "false");
    $("shift-score").textContent = "0";
    $("results-dialog").close();
    $("results-kicker").textContent = "SHIFT SUMMARY";
    $("results-title").textContent = "Sector review";
    $("results-caveat").textContent = "Aircraft, separation checks, fuel, and emissions are simulated estimates, not operational guidance.";
    $("play-again").textContent = "RESTART SHIFT";
    $("play-again").setAttribute("aria-label", "Restart shift");
    setMessage("Select a flight to view its available actions.");
    renderUI();
    drawRadar();
  }

  function updateMovement(simulatedSeconds) {
    const steps = Math.max(1, Math.ceil(simulatedSeconds / 0.25));
    const dt = simulatedSeconds / steps;
    for (let step = 0; step < steps; step += 1) {
      state.simTime += dt;
      updateWeather();
      for (const plane of state.aircraft) {
        if (["gate", "holding", "taxi-queue", "taxi-hold"].includes(plane.stage)) {
          plane.delaySeconds += dt;
          state.delaySeconds += dt;
          continue;
        }
        if (plane.stage === "taxi-safety-hold") {
          if (!runwayPathBusy(plane) && !departureBlockReason(plane)) plane.stage = "taxi";
          else {
            plane.delaySeconds += dt;
            state.delaySeconds += dt;
            continue;
          }
        }
        if (plane.stage === "taxi") {
          if (arrivalPathBusy(plane) || departureBlockReason(plane)) {
            plane.stage = "taxi-safety-hold";
            continue;
          }
          
        if (plane.stage === "taxi") {
          plane.stage = "gate";
          plane.taxiElapsed = 0;
          continue;
        }

        if (plane.stage === "taxi-queue" || plane.stage === "taxi-hold") {
          plane.stage = "gate";
          plane.taxiElapsed = 0;
          continue;
        }

        
        if (plane.stage === "runway") {
          plane.runwayRemaining -= dt;

          if (plane.runwayRemaining <= 0) {
            plane.stage = "takeoff";
            plane.takeoffElapsed = 0;
            plane.takeoffOrigin = { x: plane.x, y: plane.y };

            const runway = RUNWAYS.find(
              (item) => item.id === plane.runwayId
            );
            plane.takeoffHeading = runway?.heading ?? 0;
          }

          continue;
        }

        if (plane.stage === "takeoff") {
          plane.takeoffElapsed += dt;

          const progress = Math.min(
            1,
            plane.takeoffElapsed / TAKEOFF_DURATION_SECONDS
          );
          const heading = (plane.takeoffHeading ?? 0) * Math.PI / 180;
          const distance = progress * 4;

          plane.x = plane.takeoffOrigin.x + Math.sin(heading) * distance;
          plane.y = plane.takeoffOrigin.y - Math.cos(heading) * distance;

          if (progress >= 1) {
            plane.stage = "airborne";
            plane.altitude = 600;
            plane.targetAltitude = plane.cruiseAltitude;
            plane.heading = plane.takeoffHeading ?? 0;
            plane.departed = true;
            state.departures += 1;

            if (isSafeFlightEvent(plane)) {
              state.safeDepartures += 1;
              awardPoints(25);
            }
          }

          continue;
        }
        if (plane.stage === "landing") {
          plane.runwayRemaining -= dt * (state.weather.visibility < 3 ? 0.7 : 1);
          if (plane.runwayRemaining <= 0) {
            plane.stage = "taxi-in";
            plane.taxiElapsed = 0;
            plane.gateX = [-16, -8, 0, 8, 16][state.arrivals % 5];
          }
          continue;
        }
        if (plane.stage === "taxi-in") {
          plane.taxiElapsed += dt;
          const progress = Math.min(1, plane.taxiElapsed / TAXI_IN_SECONDS);
          plane.x = RUNWAY_POINT.x + (plane.gateX - RUNWAY_POINT.x) * progress;
          plane.y = RUNWAY_POINT.y + (7 - RUNWAY_POINT.y) * progress;
          plane.heading = bearing(RUNWAY_POINT, { x: plane.gateX, y: 7 });
          if (progress >= 1) {
            plane.stage = "parked";
            plane.arrived = true;
            plane.cleared = false;
            state.arrivals += 1;
            if (isSafeFlightEvent(plane)) {
              state.safeArrivals += 1;
              awardPoints(25);
            }
          }
          continue;
        }
        if (!plane.cleared || plane.arrived || !["airborne", "approach"].includes(plane.stage)) continue;
        const target = currentTarget(plane);
        if (!plane.departure && target?.name === "RUNWAY 09" && runwayPathBusy(plane)) {
          plane.stage = "holding";
          plane.cleared = false;
          continue;
        }
        if (!target) {
          plane.arrived = true;
          plane.cleared = false;
          plane.stage = "arrived";
          if (!plane.departure) state.arrivals += 1;
          continue;
        }
        if (plane.holdHeading !== null && state.simTime < plane.holdUntil) {
          plane.heading = plane.holdHeading;
        } else {
          plane.holdHeading = null;
          plane.heading = bearing(plane, target);
        }
        const radians = plane.heading * Math.PI / 180;
        const legDistance = groundSpeedFor(plane.heading, plane.speed) * dt / 3600;
        const toTarget = distance(plane, target);
        const travel = Math.min(toTarget, legDistance);
        plane.x += Math.sin(radians) * travel;
        plane.y += Math.cos(radians) * travel;
        const altitudeDifference = plane.targetAltitude - plane.altitude;
        const climb = Math.sign(altitudeDifference) * Math.min(Math.abs(altitudeDifference), 1800 * dt / 60);
        plane.altitude += climb;
        plane.flownNm += travel;
        plane.trail.push({ x: plane.x, y: plane.y });
        if (plane.trail.length > 18) plane.trail.shift();
        if (toTarget <= legDistance + 0.03) {
          plane.x = target.x;
          plane.y = target.y;
          plane.routeIndex += 1;
          if (plane.routeIndex >= plane.route.length) {
            plane.holdHeading = null;
            if (!plane.departure && plane.stage === "approach") {
              plane.stage = "landing";
              plane.cleared = false;
              plane.runwayRemaining = RUNWAY_OCCUPANCY_SECONDS + (state.weather.visibility < 3 ? 45 : 0);
              plane.altitude = 0;
              plane.x = RUNWAY_POINT.x;
              plane.y = RUNWAY_POINT.y;
            } else {
              plane.arrived = true;
              plane.cleared = false;
              plane.stage = "arrived";
            }
          }
        }
      }
      startNextQueuedDeparture();
      scheduleTraffic();
      const collision = detectCollision();
      if (collision) {
        endShift(collision);
        return;
      }
      if (state.finished) return;
    }
  }

 
function scheduleTraffic() {
  archiveCompletedFlights();

  while (state.simTime >= state.nextTrafficAt) {
    if (state.aircraft.length < MAX_LOCAL_AIRCRAFT) {
      const slot = state.scheduledIndex++;
      const template = SHIFT_DEPARTURES[(slot + 4) % SHIFT_DEPARTURES.length];
      const generated = createDeparture(template);

      generated.id = `AC${String(700 + slot).padStart(3, "0")}`;
      state.aircraft.push(generated);
    }

    state.nextTrafficAt += Math.max(
      65,
      175 - Math.floor(state.simTime / 140) * 16
    );
  }
}

  function archiveCompletedFlights() {
    const completed = state.aircraft.filter((plane) => plane.arrived || plane.stage === "parked");
    if (!completed.length) return;
    state.completedFlights.push(...completed.map((plane) => ({ ...plane, route: [...plane.route], trail: [...plane.trail] })));
    state.aircraft = state.aircraft.filter((plane) => !plane.arrived && plane.stage !== "parked");
    if (!state.aircraft.some((plane) => plane.id === state.selectedId)) state.selectedId = state.aircraft[0]?.id ?? null;
  }

  function commandResult(result) {
    if (result.ok) {
      analyzeConflicts();
      setMessage(conflictOutcome(result), "success");
    } else {
      setMessage(`Rejected: ${result.message}`, "error");
    }

    function conflictOutcome(result) {
      const previous = state.commandConflictSnapshot || new Set();
      const remaining = [...state.activeConflictKeys].filter((key) => previous.has(key));
      const newlyActive = [...state.activeConflictKeys].filter((key) => !previous.has(key));
      if (newlyActive.length) {
        const pair = state.conflicts.find((item) => newlyActive.includes(`${item.kind}:${pairKey(item.first, item.second)}`));
        if (pair) {
          if (pair.kind === "runway") {
            return `${result.message} Runway demand: ${pair.first.id} / ${pair.second.id} are competing for the shared runway.`;
          }
          const label = "POTENTIAL CONFLICT";
          return `${result.message} New ${label}: ${pair.first.id} / ${pair.second.id}, ${pair.horizontalNm.toFixed(1)} NM / ${Math.round(pair.verticalFt)} ft at closest approach.`;
        }
      }
      if (!previous.size || !result.controlChange) return result.message;
      if (remaining.length === 0 && previous.size > 0) {
        return `${result.message} The previous modeled alert(s) are no longer predicted; continue monitoring all traffic.`;
      }
      const predictions = state.conflicts.filter((pair) => previous.has(`${pair.kind}:${pairKey(pair.first, pair.second)}`));
      const closest = predictions.sort((a, b) => a.seconds - b.seconds)[0];
      if (closest) {
        return `${result.message} Potential conflict remains: ${closest.first.id} / ${closest.second.id}, CPA ${Math.round(closest.seconds / 60)} min, ${closest.horizontalNm.toFixed(1)} NM / ${Math.round(closest.verticalFt)} ft.`;
      }
      return `${result.message} The traffic state changed; review the active alerts.`;
    }
    renderUI();
    drawRadar();
  }

  function parseCommand(raw) {
    const input = raw.trim().toUpperCase().replace(/\s+/g, " ");
    if (input === "HELP") {
      return { ok: true, message: "Select an aircraft to see the available flight-control actions." };
    }
    if (input === "STATUS") return { ok: false, message: "Add an aircraft callsign to the STATUS command." };
    let match = input.match(/^STATUS ([A-Z]{1,2}\d{2,3})$/);
    if (match) {
      const plane = getPlane(match[1]);
      if (!plane) return invalidFlight(match[1]);
      state.selectedId = plane.id;
      return { ok: true, message: `${plane.id}: ${Math.round(plane.altitude)} ft, ${Math.round(plane.speed)} kt, heading ${Math.round(plane.heading)}°. Stage ${plane.stage.toUpperCase()}; ${plane.arrived ? "route complete." : `next ${currentTarget(plane)?.name || "none"}.`} Remaining ${remainingRouteNm(plane).toFixed(1)} NM.` };
    }
    match = input.match(/^(?:DEPART|RELEASE|CLEAR) ([A-Z]{2}\d{3}|[A-Z]\d{2})$/);
    if (match) {
      const plane = getPlane(match[1]);
      if (!plane) return invalidFlight(match[1]);
      if (plane.stage === "taxi-hold") {
        if (runwayPathBusy(plane)) {
          plane.stage = "taxi-queue";
          plane.taxiQueueOrder = state.nextTaxiQueueOrder++;
          return { ok: true, controlChange: true, message: `${plane.id} is waiting in the taxi queue until its route is clear.` };
        }
        plane.stage = "taxi";
        return { ok: true, controlChange: true, message: `${plane.id} resumes taxi from its hold position.` };
      }
      if (plane.arrived || !currentTarget(plane)) return { ok: false, message: `${plane.id} has no remaining route to clear.` };
      if (plane.stage !== "gate" || !plane.departure) return { ok: false, message: `${plane.id} is not waiting at a departure gate.` };
      return { ok: true, controlChange: true, message: authorizeDeparture(plane) };
      if (plane.cleared) return { ok: false, message: `${plane.id} is already cleared on its route.` };
      plane.cleared = true;
      return { ok: true, controlChange: true, message: `${plane.id} cleared on the filed route.` };
    }
    match = input.match(/^(?:ARRIVAL|APPROACH) ([A-Z]{2}\d{3})$/);
    if (match) {
      const plane = getPlane(match[1]);
      if (!plane) return invalidFlight(match[1]);
      if (plane.departure || plane.stage !== "holding") return { ok: false, message: `${plane.id} is not a holding arrival available for approach clearance.` };
      plane.stage = "approach";
      plane.cleared = true;
      plane.heading = bearing(plane, currentTarget(plane));
      return { ok: true, controlChange: true, message: `${plane.id} cleared from the holding fix onto the simulated approach.` };
    }
    match = input.match(/^DESTINATION ([A-Z]{2}\d{3}|[A-Z]\d{2}) ([A-Z]+(?: [A-Z]+)*)$/);
    if (match) {
      const plane = getPlane(match[1]);
      if (!plane) return invalidFlight(match[1]);
      if (!plane.departure || plane.stage !== "gate") {
        return { ok: false, message: `${plane.id} destination can only be selected while it is waiting at a departure gate.` };
      }
      const destinationKey = match[2].replace(/\s+/g, "");
      const destination = DESTINATIONS[destinationKey];
      if (!destination) {
        return { ok: false, message: "That destination is not supported. Use Toronto, Vancouver, New York, London, Tokyo, or Paris." };
      }
      const previousDistance = remainingRouteNm(plane);
      const waypoint = plane.route[0];
      const cityName = {
        TORONTOPEARSON: "TORONTO", LONDONHEATHROW: "LONDON",
        TOKYOHANEDA: "TOKYO", PARISCHARLESDEGAULLE: "PARIS"
      }[destinationKey] || destinationKey;
      plane.destinationName = cityName;
      plane.route = [
        ...(waypoint && WAYPOINTS[waypoint.name] ? [waypoint] : []),
        { name: cityName, ...destination }
      ];
      plane.routeIndex = 0;
      return {
        ok: true, controlChange: true,
        message: `${plane.id} destination set to ${cityName}; the route estimate is updated.${routeChangeNote(plane, previousDistance, false)}`
      };
    }
    match = input.match(/^REROUTE ([A-Z]{2}\d{3})$/);
    if (match) {
      const plane = getPlane(match[1]);
      const emergency = state.weatherEmergency;
      if (!plane || !emergency?.targetIds.includes(plane.id) ||
          !["airborne", "approach"].includes(plane.stage)) {
        return { ok: false, message: `${match[1]} cannot be rerouted for this emergency in its current state.` };
      }
      const pair = emergency.kind === "conflict"
        ? state.conflicts.find((item) => `${item.kind}:${pairKey(item.first, item.second)}` === emergency.pairKey)
        : null;
      const waypointName = emergency.kind === "weather"
        ? findWeatherReroute(plane)
        : pair && findConflictWaypoint(plane, pair);
      if (!waypointName) {
        return { ok: false, message: `No alternate route is available for ${plane.id} in the current simulated conditions.` };
      }
      const route = proposedRoute(plane, waypointName);
      if (!route) return { ok: false, message: `The alternate route for ${plane.id} is unavailable.` };
      plane.route = route;
      plane.routeIndex = 0;
      plane.arrived = false;
      return { ok: true, controlChange: true, message: `${plane.id} rerouted via ${WAYPOINT_LABELS[waypointName] || waypointName}.` };
    }
    match = input.match(/^HOLD ([A-Z]{2}\d{3}|[A-Z]\d{2})$/);
    if (match) {
      const plane = getPlane(match[1]);
      if (!plane) return invalidFlight(match[1]);
      if (plane.stage === "taxi") {
        plane.stage = "taxi-hold";
        return { ok: true, controlChange: true, message: `${plane.id} stopped taxiing at its current position.` };
      }
      if (plane.arrived || ["gate", "holding", "taxi-hold", "runway", "landing", "taxi-in", "parked"].includes(plane.stage)) return { ok: false, message: `${plane.id} cannot accept a heading hold in its current stage.` };
      plane.holdHeading = plane.heading;
      plane.holdUntil = state.simTime + 240;
      return { ok: true, controlChange: true, message: `${plane.id} assigned a four-minute heading hold.` };
    }
    match = input.match(/^TURN ([A-Z]{2}\d{3}|[A-Z]\d{2}) HEADING (\d{1,3})$/);
    if (match) {
      const plane = getPlane(match[1]);
      const heading = Number(match[2]);
      if (!plane) return invalidFlight(match[1]);
      if (heading > 359) return { ok: false, message: "Heading must be between 000 and 359 degrees." };
      plane.holdHeading = heading;
      plane.holdUntil = state.simTime + 180;
      plane.heading = heading;
      return { ok: true, controlChange: true, message: `${plane.id} heading set to ${String(heading).padStart(3, "0")}° for three simulated minutes, then it resumes its filed route.` };
    }
    match = input.match(/^SET ([A-Z]{2}\d{3}|[A-Z]\d{2}) ALTITUDE (\d{4,5})$/);
    if (match) {
      const plane = getPlane(match[1]);
      const altitude = Number(match[2]);
      if (!plane) return invalidFlight(match[1]);
      if (altitude < 1000 || altitude > 39000 || altitude % 1000 !== 0) {
        return { ok: false, message: "For this demo, choose an altitude from 1000 to 39000 ft in 1000-ft increments." };
      }
      plane.targetAltitude = altitude;
      return { ok: true, controlChange: true, message: `${plane.id} target altitude set to ${altitude.toLocaleString()} ft. The simplified model changes altitude gradually.` };
    }
    match = input.match(/^DIRECT ([A-Z]{2}\d{3}|[A-Z]\d{2}) WAYPOINT ([A-Z]+)$/);
    if (match) {
      const plane = getPlane(match[1]);
      const waypoint = WAYPOINTS[match[2]];
      if (!plane) return invalidFlight(match[1]);
      if (!waypoint) return { ok: false, message: `Unknown waypoint ${match[2]}. Try ${Object.keys(WAYPOINTS).join(", ")}.` };
      const previousDistance = remainingRouteNm(plane);
      plane.route = [{ name: match[2], ...waypoint }, ...plane.route.slice(-1)];
      plane.routeIndex = 0;
      plane.arrived = false;
      return { ok: true, controlChange: true, message: `${plane.id} route changed direct to ${WAYPOINT_LABELS[match[2]] || match[2]}, then its destination.${routeChangeNote(plane, previousDistance)}` };
    }
    match = input.match(/^ROUTE ([A-Z]{2}\d{3}|[A-Z]\d{2}) VIA ([A-Z]+)$/);
    if (match) {
      const plane = getPlane(match[1]);
      const waypoint = WAYPOINTS[match[2]];
      if (!plane) return invalidFlight(match[1]);
      if (!waypoint) return { ok: false, message: `Unknown waypoint ${match[2]}. Try ${Object.keys(WAYPOINTS).join(", ")}.` };
      const destination = plane.route.at(-1);
      if (!destination) return { ok: false, message: `${plane.id} has no destination.` };
      const previousDistance = remainingRouteNm(plane);
      plane.route = [{ name: match[2], ...waypoint }, destination];
      plane.routeIndex = 0;
      plane.arrived = false;
      return { ok: true, controlChange: true, message: `${plane.id} route now passes via ${WAYPOINT_LABELS[match[2]] || match[2]} before ${destination.name}.${routeChangeNote(plane, previousDistance)}` };
    }
    return { ok: false, message: "This action is not available. Choose from the controls shown for the selected aircraft." };
  }

  function getPlane(id) {
    return state.aircraft.find((plane) => plane.id === id);
  }

  function invalidFlight(id) {
    return { ok: false, message: `No aircraft with callsign ${id} in this scenario.` };
  }

  function routeChangeNote(plane, previousDistance) {
    const plannedDistance = remainingRouteNm(plane);
    const difference = plannedDistance - previousDistance;
    const fuelDifference = difference * FUEL_KG_PER_NM;
    const co2Difference = fuelDifference * CO2_KG_PER_KG_FUEL;
    const signed = (value) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
    const impact = ` Remaining route ${plannedDistance.toFixed(1)} NM (${signed(difference)} NM); model estimate change vs previous remaining route: ${signed(fuelDifference)} kg fuel, ${signed(co2Difference)} kg CO₂.`;
    return impact;
  }

  function departureBlockReason(plane) {
    if (state.departuresPaused) return "Departures paused";
    if (state.weather.condition === "THUNDERSTORM") {
      return "Storm warning — departure restricted";
    }
    if (state.weather.visibility < 2) return "Low visibility — departure restricted";
    return "";
  }

  function arrivalPathBusy(plane) {
    return state.aircraft.some((other) =>
      other !== plane && (
        ["landing", "taxi-in"].includes(other.stage) ||
        (other.stage === "approach" && distance(other, AIRPORT_POINT) <= 4)
      )
    );
  }

  function runwayPathBusy(plane) {
    return state.aircraft.some((other) =>
      other !== plane && (
        ["taxi", "taxi-hold", "taxi-safety-hold", "runway", "takeoff", "landing", "taxi-in"].includes(other.stage) ||
        (other.stage === "approach" && distance(other, AIRPORT_POINT) <= 4)
      )
    );
  }

  
function authorizeDeparture(plane) {
  plane.cleared = true;
  plane.taxiElapsed = 0;
  plane.cruiseAltitude = plane.targetAltitude;

  if (runwayPathBusy(plane)) {
    plane.stage = "taxi-queue";
    plane.taxiQueueOrder = state.nextTaxiQueueOrder++;
    return `${plane.id} authorized and waiting in the taxi queue.`;
  }

  plane.stage = "taxi";
  return `${plane.id} authorized and taxiing toward AIRPORT.`;
}

function dispatchOnRunway(plane, runwayId) {
  const runway = RUNWAYS.find((item) => item.id === runwayId);

  if (!runway || !plane || plane.stage !== "gate") return;

  const availableAt = runwayAvailableAt.get(runwayId) ?? 0;

  if (
    state.paused ||
    state.finished ||
    state.departuresPaused ||
    state.simTime < availableAt
  ) {
    return;
  }

  const reason = departureBlockReason(plane);

  if (reason) {
    setMessage(reason, "warning");
    renderUI();
    return;
  }

  plane.cleared = true;
  plane.cruiseAltitude = plane.targetAltitude;
  plane.runwayId = runwayId;
  plane.x = runway.x;
  plane.y = runway.y;
  plane.stage = "runway";
  plane.runwayRemaining = 0;

  runwayAvailableAt.set(runwayId, state.simTime + 20);

  setMessage(
    `${plane.id} cleared for departure on runway ${runwayId}.`,
    "success"
  );
  renderUI();
}



  function startNextQueuedDeparture() {
    if (state.aircraft.some((plane) => plane.stage === "taxi")) return;
    const next = state.aircraft
      .filter((plane) => plane.stage === "taxi-queue")
      .sort((first, second) => first.taxiQueueOrder - second.taxiQueueOrder)[0];
    if (!next || runwayPathBusy(next) || departureBlockReason(next)) return;
    next.stage = "taxi";
    next.taxiElapsed = 0;
    next.x = next.gateX;
    next.y = 7;
  }

  function applyControlAction(command) {
    if (state.finished) return setMessage("This shift has ended. Restart to play again.", "error");
    if (state.paused) return setMessage("Resume the simulation before choosing an action.", "error");
    const normalized = command.toUpperCase().replace(/\s+/g, " ");
    const flightId = normalized.match(/\b(?:AC|IN)\d{3}\b/)?.[0];
    const plane = flightId ? getPlane(flightId) : null;
    if (/^(?:DEPART|RELEASE|CLEAR) /.test(normalized) && plane?.stage === "gate") {
      const reason = departureBlockReason(plane);
      if (reason) return setMessage(`${reason}. ${plane.id} remains at the gate.`, "warning");
    }
    if (/^(?:ARRIVAL|APPROACH) /.test(normalized)) {
      const reason = departureBlockReason(plane);
      if (reason && reason !== "Departures paused") return setMessage(`${reason}. The arrival remains in the holding area.`, "warning");
    }

    state.commandConflictSnapshot = new Set(state.activeConflictKeys);
    state.lastCommand = normalized;
    const result = parseCommand(normalized);
    commandResult(result);
    renderUI();
  }

  function submitEmergencyResponse(event) {
    event.preventDefault();
    const emergency = state.weatherEmergency;
    if (!emergency) return;
    if (performance.now() >= emergency.deadline) {
      updateEmergencyCountdown();
      return;
    }
    const command = $("emergency-command-input").value.trim().toUpperCase().replace(/\s+/g, " ");
    if (!command) {
      $("emergency-feedback").textContent = "Enter a command to respond. The countdown continues.";
      $("emergency-command-input").focus();
      return;
    }
    state.emergencyAttempts += 1;
    if (command !== emergency.requiredCommand) {
      $("emergency-feedback").textContent = "That command does not match this emergency. The countdown continues.";
      $("emergency-command-input").value = "";
      $("emergency-command-input").focus();
      return;
    }
    state.emergencyCommandMatches += 1;

    state.commandConflictSnapshot = new Set(state.activeConflictKeys);
    state.lastCommand = command;
    const result = parseCommand(command);
    if (!result.ok) {
      $("emergency-feedback").textContent = `${result.message} The emergency remains active; the countdown continues.`;
      $("emergency-command-input").value = "";
      $("emergency-command-input").focus();
      return;
    }

    commandResult(result);
    const resolved = emergency.kind === "weather"
      ? !emergency.targetIds.some((id) => {
          const plane = getPlane(id);
          return plane && aircraftWeatherRisk(plane);
        })
      : !state.activeConflictKeys.has(emergency.pairKey);
    if (!resolved) {
      $("emergency-feedback").textContent = `That command did not clear the modeled danger. Traffic remains paused; the countdown continues.`;
      $("emergency-command-input").value = "";
      $("emergency-command-input").focus();
      return;
    }

    state.weatherEmergency = null;
    state.paused = false;
    state.emergenciesResolved += 1;
    awardPoints(100);
    $("emergency-alert").hidden = true;
    $("emergency-command-input").value = "";
    setMessage(`${result.message} The modeled emergency has cleared; +100 points. Traffic resumes.`, "success");
    renderUI();
    drawRadar();
  }

  function renderUI() {
    $("sim-clock").textContent = formatClock(state.simTime);
    $("aircraft-count").textContent = `${state.aircraft.length} / ${MAX_LOCAL_AIRCRAFT}`;
    $("shift-score").textContent = String(state.score);
    $("pause-button").textContent = state.paused ? "Resume" : "Pause";
    $("pause-button").disabled = state.finished || Boolean(state.weatherEmergency);
    $("pause-button").setAttribute("aria-pressed", String(state.paused));
    const totals = metrics();
    $("total-distance").textContent = `${totals.distanceNm.toFixed(1)} NM`;
    $("total-fuel").textContent = `${Math.round(totals.fuelKg).toLocaleString()} kg`;
    $("total-co2").textContent = `${Math.round(totals.co2Kg).toLocaleString()} kg`;
    renderTraffic();
    renderSelected();
    renderAircraftActions();
    renderSafety();
    renderWeather();
    renderShiftMetrics();
  }

  function renderShiftMetrics() {
    const holder = $("shift-metrics");
    const waiting = state.aircraft.filter((plane) => ["gate", "holding"].includes(plane.stage)).length;
    holder.innerHTML = `<span>${state.departures} DEPARTED</span><span>${state.arrivals} ARRIVED</span><span>${waiting} WAITING</span><span>${Math.round(state.delaySeconds / 60)} MIN DELAY</span>`;
  }

  function renderTraffic() {
    const list = $("traffic-list");
    const key = state.aircraft.map((plane) => [
      plane.id, plane.stage, plane.id === state.selectedId ? "selected" : "",
      state.conflicts.some((pair) => pair.first === plane || pair.second === plane) ? "alert" : ""
    ].join(":")).join("|");
    if (list.dataset.renderKey === key) return;
    list.dataset.renderKey = key;
    list.replaceChildren();
    for (const plane of state.aircraft) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = `traffic-row${state.conflicts.some((pair) => pair.first === plane || pair.second === plane) ? " has-alert" : ""}`;
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", String(plane.id === state.selectedId));
      const dot = document.createElement("i");
      dot.className = "traffic-diamond";
      const info = document.createElement("span");
      info.className = "traffic-call";
      const call = document.createElement("strong");
      call.textContent = plane.id;
      const meta = document.createElement("small");
      meta.textContent = `${plane.airline} · ${plane.aircraftType}`;
      info.append(call, meta);
      const status = document.createElement("span");
      const hasAlert = state.conflicts.some((pair) => pair.first === plane || pair.second === plane);
      status.className = hasAlert ? "traffic-alert" : "traffic-track";
      status.textContent = hasAlert ? "ALERT" : stageLabel(plane);
      row.append(dot, info, status);
      row.addEventListener("click", () => selectAircraft(plane.id));
      list.append(row);
    }
  }

  function renderSelected() {
    const plane = getPlane(state.selectedId);
    const holder = $("selected-detail");
    holder.replaceChildren();
    if (!plane) return;
    const target = currentTarget(plane);
    const name = document.createElement("strong");
    name.textContent = `${plane.id} · ${stageLabel(plane)}`;
    const detail = document.createElement("p");
    detail.textContent = `${plane.origin} → ${plane.destinationName} · ${target ? `next ${WAYPOINT_LABELS[target.name] || target.name}` : "route complete"} · ${Math.round(plane.altitude).toLocaleString()} ft · ${Math.round(plane.speed)} kt · HDG ${String(Math.round(plane.heading) % 360).padStart(3, "0")}`;
    holder.append(name, detail);
  }

  function addActionButton(holder, label, command, options = {}) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `button ${options.primary ? "button-primary" : ""} ${options.danger ? "button-danger" : ""}`.trim();
    button.textContent = label;
    button.disabled = Boolean(options.disabled || state.paused || state.finished);
    if (options.title) button.title = options.title;
    button.addEventListener("click", () => {
      if (typeof command === "function") command();
      else applyControlAction(command, Boolean(options.emergency));
    });
    holder.append(button);
    return button;
  }

 function authorizeDeparture(plane)

  function stageLabel(plane) {
    if (plane.stage === "taxi-queue") return `TAXI QUEUE #${taxiQueuePosition(plane)}`;
    return ({
      gate: "GATE",
      taxi: "TAXI",
      "taxi-hold": "TAXI HOLD",
      "taxi-safety-hold": "HOLDING FOR SAFETY",
      runway: "RUNWAY",
      takeoff: "TAKEOFF",
      airborne: "AIRBORNE",
      holding: "HOLDING",
      approach: "APPROACH",
      landing: "LANDING",
      "taxi-in": "TAXI TO GATE",
      parked: "PARKED",
      arrived: "EN ROUTE COMPLETE"
    })[plane.stage] || plane.stage.toUpperCase();
  }

  function taxiQueuePosition(plane) {
    return state.aircraft
      .filter((aircraft) => aircraft.stage === "taxi-queue")
      .sort((first, second) => first.taxiQueueOrder - second.taxiQueueOrder)
      .indexOf(plane) + 1;
  }

  function renderWeather() {
    $("weather-condition").textContent = state.weather.condition;
    $("weather-wind").textContent = state.weather.speed
      ? `${state.weather.speed} KT · ${String(state.weather.direction).padStart(3, "0")}°`
      : "CALM";
    $("weather-visibility").textContent = `${state.weather.visibility} NM`;
    const risks = state.aircraft.filter(aircraftWeatherRisk).map((plane) => plane.id);
    $("weather-warning").textContent = risks.length
      ? `WEATHER ROUTE RISK · ${risks.join(" / ")}`
      : state.weather.warning;
    $("emergency-alert").hidden = !state.weatherEmergency;
  }

  function renderSafety() {
    const banner = $("safety-banner");
    const text = $("safety-text");
    banner.classList.toggle("alert", state.conflicts.length > 0);
    banner.classList.toggle("safe", state.conflicts.length === 0);
    if (state.conflicts.length) {
      const nearest = [...state.conflicts].sort((a, b) => a.seconds - b.seconds)[0];
      text.textContent = nearest.kind === "runway"
        ? `RUNWAY DEMAND · ${nearest.first.id} / ${nearest.second.id} · both aircraft are taxiing or using the shared runway.`
        : `POTENTIAL CONFLICT · ${nearest.first.id} / ${nearest.second.id} · CPA ${Math.round(nearest.seconds / 60)} min · ${nearest.horizontalNm.toFixed(1)} NM / ${Math.round(nearest.verticalFt)} ft`;
    } else if (state.aircraft.some(aircraftWeatherRisk)) {
      banner.classList.add("alert");
      banner.classList.remove("safe");
      text.textContent = `WEATHER ROUTE RISK · ${state.aircraft.filter(aircraftWeatherRisk).map((plane) => plane.id).join(" / ")} · inspect the storm area on radar.`;
    } else {
      text.textContent = "No modeled conflicts. Traffic continues while you manage the shift.";
    }
  }

  function fitCanvas() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(rect.width * ratio);
    const height = Math.round(rect.height * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { width: rect.width, height: rect.height };
  }

  function toCanvas(point, width, height) {
    const scale = Math.min(width, height) / (radarRangeNm * 2);
    return {
      x: width / 2 + point.x * scale,
      y: height / 2 - point.y * scale
    };
  }

  function drawAirport(timestamp = 0) {
      const bounds = airportCanvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.round(bounds.width * ratio);
      const pixelHeight = Math.round(bounds.height * ratio);
      if (airportCanvas.width !== pixelWidth || airportCanvas.height !== pixelHeight) {
        airportCanvas.width = pixelWidth;
        airportCanvas.height = pixelHeight;
      }
      airportContext.setTransform(ratio, 0, 0, ratio, 0, 0);
      const ctx = airportContext;
      const width = bounds.width;
      const height = bounds.height;
      const horizon = height * 0.48;
      const palettes = {
        day: { top: "#75a8c0", mid: "#c3d5d7", ground: "#556e58", distant: "#718276", sun: "#fff0c5", glow: 0.3 },
        sunset: { top: "#3d5979", mid: "#e39a73", ground: "#3d5548", distant: "#74675d", sun: "#ffd0a0", glow: 0.23 },
        night: { top: "#07182e", mid: "#233c55", ground: "#172b24", distant: "#35434a", sun: "#e1ebed", glow: 0.1 }
      };
      const colors = palettes[airportLighting] || palettes.day;
      ctx.clearRect(0, 0, width, height);

      const sky = ctx.createLinearGradient(0, 0, 0, horizon * 1.25);
      sky.addColorStop(0, colors.top);
      sky.addColorStop(0.72, colors.mid);
      sky.addColorStop(1, "#d9d6c7");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, horizon * 1.4);
      const sunX = width * 0.77;
      const sunY = height * (airportLighting === "sunset" ? 0.34 : 0.2);
      const halo = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, width * 0.14);
      halo.addColorStop(0, `rgba(255, 232, 188, ${colors.glow})`);
      halo.addColorStop(1, "rgba(255, 232, 188, 0)");
      ctx.fillStyle = halo;
      ctx.fillRect(sunX - width * 0.14, sunY - width * 0.14, width * 0.28, width * 0.28);
      ctx.fillStyle = colors.sun;
      ctx.beginPath();
      ctx.arc(sunX, sunY, airportLighting === "night" ? 7 : 13, 0, Math.PI * 2);
      ctx.fill();

      drawCloud(ctx, width * 0.18 + ((timestamp / 95000 * width) % (width * 1.1)) - width * 0.08, height * 0.22, 1, airportLighting);
      drawCloud(ctx, width * 0.53 + ((timestamp / 155000 * width) % (width * 1.2)) - width * 0.12, height * 0.31, 0.68, airportLighting);
      drawCloud(ctx, width * 0.78 - ((timestamp / 128000 * width) % (width * 1.1)), height * 0.16, 0.52, airportLighting);

      ctx.fillStyle = colors.distant;
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      ctx.lineTo(0, horizon * 0.93);
      ctx.lineTo(width * 0.08, horizon * 0.91);
      ctx.lineTo(width * 0.13, horizon * 0.95);
      ctx.lineTo(width * 0.2, horizon * 0.9);
      ctx.lineTo(width * 0.3, horizon * 0.94);
      ctx.lineTo(width * 0.38, horizon * 0.89);
      ctx.lineTo(width * 0.49, horizon * 0.93);
      ctx.lineTo(width * 0.63, horizon * 0.9);
      ctx.lineTo(width * 0.7, horizon * 0.94);
      ctx.lineTo(width * 0.83, horizon * 0.91);
      ctx.lineTo(width, horizon * 0.93);
      ctx.lineTo(width, horizon * 1.2);
      ctx.closePath();
      ctx.fill();

      const grass = ctx.createLinearGradient(0, horizon, 0, height);
      grass.addColorStop(0, airportLighting === "night" ? "#253a30" : "#63775d");
      grass.addColorStop(1, airportLighting === "night" ? "#101c19" : "#364c3a");
      ctx.fillStyle = grass;
      ctx.fillRect(0, horizon, width, height - horizon);
      ctx.fillStyle = airportLighting === "night" ? "#253139" : "#818b84";
      ctx.fillRect(width * 0.04, horizon * 1.01, width * 0.92, height * 0.022);
      ctx.fillStyle = airportLighting === "night" ? "#1c282d" : "#a5aaa3";
      ctx.fillRect(width * 0.055, horizon * 1.01, width * 0.89, height * 0.006);

      drawTerminal(ctx, width, height, airportLighting);
      drawHangar(ctx, width * 0.08, horizon * 0.95, width * 0.12, height * 0.12, airportLighting);
      drawHangar(ctx, width * 0.83, horizon * 0.94, width * 0.105, height * 0.095, airportLighting);
      drawRunway(ctx, width, height, airportLighting);
      drawWindsock(ctx, width * 0.19, horizon * 1.04, height * 0.12, airportLighting, timestamp);
      drawWeatherOutside(ctx, width, height, timestamp);
    }

    function drawTaxiingAircraft(ctx, width, height) {
      for (const plane of state.aircraft) {
        if (!plane.departure || !["taxi", "runway", "takeoff"].includes(plane.stage)) continue;
        let x;
        let y;
        let scale = Math.max(1, width / 900);
        if (plane.stage === "taxi") {
          const progress = Math.min(1, plane.taxiElapsed / TAXI_DURATION_SECONDS);
          x = 0.5 + (plane.gateX / 28 * 0.38) * (1 - progress);
          y = 0.86 - 0.25 * progress;
        } else if (plane.stage === "runway") {
  const runway = RUNWAYS.find((item) => item.id === plane.runwayId);
  x = runway?.screenX ?? 0.5;
  y = 0.61;
} else {
  const runway = RUNWAYS.find((item) => item.id === plane.runwayId);
  const runwayX = runway?.screenX ?? 0.5;
  const progress = Math.min(1, plane.takeoffElapsed / TAKEOFF_DURATION_SECONDS);
  x = runwayX + (runway?.heading === 90 ? 1 : runway?.heading === 270 ? -1 : 0) * progress * 0.2;
  y = 0.61 - (runway?.heading === 0 ? 1 : 0) * progress * 0.2;
  scale *= 1 - progress * 0.35;
}
        const centerX = x * width;
        const centerY = y * height;
        ctx.save();
        const runway = RUNWAYS.find((item) => item.id === plane.runwayId);
if (plane.stage === "runway" || plane.stage === "takeoff") {
  ctx.rotate(((runway?.heading ?? 0) * Math.PI) / 180);
}
        ctx.translate(centerX, centerY);
        ctx.fillStyle = "#24323b";
        ctx.beginPath();
        ctx.moveTo(0, -7 * scale);
        ctx.lineTo(2 * scale, -1 * scale);
        ctx.lineTo(8 * scale, 2 * scale);
        ctx.lineTo(8 * scale, 4 * scale);
        ctx.lineTo(2 * scale, 3 * scale);
        ctx.lineTo(1.5 * scale, 7 * scale);
        ctx.lineTo(4 * scale, 8 * scale);
        ctx.lineTo(4 * scale, 9 * scale);
        ctx.lineTo(0, 8 * scale);
        ctx.lineTo(-4 * scale, 9 * scale);
        ctx.lineTo(-4 * scale, 8 * scale);
        ctx.lineTo(-1.5 * scale, 7 * scale);
        ctx.lineTo(-2 * scale, 3 * scale);
        ctx.lineTo(-8 * scale, 4 * scale);
        ctx.lineTo(-8 * scale, 2 * scale);
        ctx.lineTo(-2 * scale, -1 * scale);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    function drawWeatherOutside(ctx, width, height, timestamp) {
      if (state.weather.hazard) {
        const x = width * (0.5 + state.weather.hazard.x / 120);
        const horizonY = height * 0.51;
        ctx.fillStyle = "rgba(65, 78, 85, .7)";
        ctx.beginPath();
        ctx.ellipse(x, horizonY - 34, 64, 17, 0, 0, Math.PI * 2);
        ctx.ellipse(x - 23, horizonY - 39, 30, 12, 0, 0, Math.PI * 2);
        ctx.ellipse(x + 26, horizonY - 43, 38, 13, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (state.weather.condition === "FOG") {
        ctx.fillStyle = "rgba(204, 214, 213, .32)";
        ctx.fillRect(0, height * 0.28, width, height * 0.72);
      }
      if (state.weather.condition === "RAIN" || state.weather.condition === "THUNDERSTORM") {
        ctx.strokeStyle = state.weather.condition === "RAIN" ? "rgba(222, 235, 239, .32)" : "rgba(211, 224, 228, .43)";
        ctx.lineWidth = 1;
        const offset = (timestamp / 28) % 28;
        for (let x = -height; x < width; x += 24) {
          ctx.beginPath();
          ctx.moveTo(x + offset, 0);
          ctx.lineTo(x - 20 + offset, Math.min(height, 70));
          ctx.stroke();
        }
      }
      if (state.weather.condition === "THUNDERSTORM") {
        const phase = timestamp % 5200;
        if (phase < 90 || (phase > 150 && phase < 220)) {
          const boltX = width * 0.72;
          ctx.fillStyle = "rgba(225, 233, 233, .24)";
          ctx.fillRect(0, 0, width, height);
          ctx.strokeStyle = "rgba(255, 248, 214, .9)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(boltX, height * 0.18);
          ctx.lineTo(boltX - 14, height * 0.29);
          ctx.lineTo(boltX + 1, height * 0.29);
          ctx.lineTo(boltX - 10, height * 0.4);
          ctx.stroke();
        }
      }
    }

    function drawCloud(ctx, x, y, scale, mode) {
      const storm = state.weather.condition === "THUNDERSTORM";
      const opacity = mode === "night" ? 0.17 : mode === "sunset" ? 0.35 : 0.5;
      ctx.fillStyle = storm ? "rgba(51, 63, 71, .82)" : `rgba(246, 247, 239, ${opacity})`;
      ctx.beginPath();
      ctx.ellipse(x, y, 27 * scale, 7 * scale, 0, 0, Math.PI * 2);
      ctx.ellipse(x - 13 * scale, y + 2 * scale, 12 * scale, 6 * scale, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 9 * scale, y - 3 * scale, 15 * scale, 9 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawTerminal(ctx, width, height, mode) {
      const horizon = height * 0.48;
      const x = width * 0.27;
      const y = horizon * 0.82;
      const w = width * 0.47;
      const h = height * 0.13;
      ctx.fillStyle = mode === "night" ? "#29343b" : "#899494";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = mode === "night" ? "#1b272e" : "#697779";
      ctx.fillRect(x + w * 0.06, y - h * 0.35, w * 0.88, h * 0.38);
      ctx.fillStyle = mode === "night" ? "#31404a" : "#aab2ad";
      ctx.fillRect(x + w * 0.11, y + h * 0.12, w * 0.77, h * 0.23);
      const windowColor = mode === "night" ? "#e7bf78" : "#b9ccd0";
      ctx.fillStyle = windowColor;
      for (let index = 0; index < 18; index += 1) {
        ctx.fillRect(x + w * 0.04 + index * w * 0.051, y + h * 0.52, Math.max(2, w * 0.027), h * 0.18);
      }
      for (let index = 0; index < 5; index += 1) {
        const gateX = x + w * (0.12 + index * 0.17);
        ctx.strokeStyle = mode === "night" ? "#606c70" : "#687579";
        ctx.lineWidth = Math.max(1, width * 0.001);
        ctx.beginPath();
        ctx.moveTo(gateX, y + h * 0.82);
        ctx.lineTo(gateX - w * 0.035, y + h * 1.38);
        ctx.stroke();
      }
    }

    function drawHangar(ctx, x, y, width, height, mode) {
      ctx.fillStyle = mode === "night" ? "#27343a" : "#7a8581";
      ctx.beginPath();
      ctx.moveTo(x, y + height * 0.27);
      ctx.lineTo(x + width * 0.15, y);
      ctx.lineTo(x + width * 0.85, y);
      ctx.lineTo(x + width, y + height * 0.27);
      ctx.lineTo(x + width, y + height);
      ctx.lineTo(x, y + height);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = mode === "night" ? "#151f24" : "#505e60";
      ctx.fillRect(x + width * 0.14, y + height * 0.37, width * 0.72, height * 0.63);
    }

    function drawTaxiways(ctx, width, height, mode) {
      const road = mode === "night" ? "#30383a" : "#909791";
      ctx.fillStyle = road;
      ctx.beginPath();
      ctx.moveTo(width * 0.06, height * 0.85);
      ctx.lineTo(width * 0.1, height * 0.85);
      ctx.lineTo(width * 0.47, height * 0.58);
      ctx.lineTo(width * 0.5, height * 0.58);
      ctx.lineTo(width * 0.12, height * 0.89);
      ctx.lineTo(width * 0.06, height * 0.89);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(width * 0.92, height * 0.84);
      ctx.lineTo(width * 0.88, height * 0.84);
      ctx.lineTo(width * 0.58, height * 0.59);
      ctx.lineTo(width * 0.55, height * 0.59);
      ctx.lineTo(width * 0.86, height * 0.88);
      ctx.lineTo(width * 0.94, height * 0.88);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = mode === "night" ? "#d0b967" : "#ece2a1";
      ctx.lineWidth = Math.max(1, width * 0.001);
      ctx.setLineDash([width * 0.009, width * 0.006]);
      ctx.beginPath();
      ctx.moveTo(width * 0.08, height * 0.87);
      ctx.lineTo(width * 0.49, height * 0.585);
      ctx.moveTo(width * 0.91, height * 0.86);
      ctx.lineTo(width * 0.565, height * 0.59);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    function drawRunway(ctx, width, height, mode) {
  const night = mode === "night";
  const topY = height * 0.58;
  const bottomY = height * 1.08;

  const runways = [
    { id: "09", topX: width * 0.24, bottomX: width * 0.22 },
    { id: "18", topX: width * 0.50, bottomX: width * 0.50 },
    { id: "27", topX: width * 0.76, bottomX: width * 0.78 }
  ];

  runways.forEach((runway) => {
    const topHalf = width * 0.012;
    const bottomHalf = width * 0.055;

    // Runway surface
    ctx.fillStyle = night ? "#222a30" : "#465157";
    ctx.beginPath();
    ctx.moveTo(runway.topX - topHalf, topY);
    ctx.lineTo(runway.topX + topHalf, topY);
    ctx.lineTo(runway.bottomX + bottomHalf, bottomY);
    ctx.lineTo(runway.bottomX - bottomHalf, bottomY);
    ctx.closePath();
    ctx.fill();

    // Runway edges
    ctx.strokeStyle = night ? "#d4d7c2" : "#e8e8dc";
    ctx.lineWidth = Math.max(1, width * 0.0015);
    ctx.beginPath();
    ctx.moveTo(runway.topX - topHalf, topY);
    ctx.lineTo(runway.bottomX - bottomHalf, bottomY);
    ctx.moveTo(runway.topX + topHalf, topY);
    ctx.lineTo(runway.bottomX + bottomHalf, bottomY);
    ctx.stroke();

    // Centreline markings
    ctx.setLineDash([width * 0.009, width * 0.012]);
    ctx.lineWidth = Math.max(1, width * 0.002);
    ctx.beginPath();
    ctx.moveTo(runway.topX, topY + height * 0.015);
    ctx.lineTo(runway.bottomX, height * 1.02);
    ctx.stroke();
    ctx.setLineDash([]);

    // Runway edge lights
    for (let index = 0; index < 12; index += 1) {
      const t = index / 12;
      const y = topY + (bottomY - topY) * t;
      const centerX = runway.topX + (runway.bottomX - runway.topX) * t;
      const spread = topHalf + (bottomHalf - topHalf) * t;
      const radius = Math.max(1, width * (0.001 + t * 0.001));

      ctx.fillStyle = night ? "#c3d9e8" : "#e9e6cf";

      [-1, 1].forEach((side) => {
        ctx.beginPath();
        ctx.arc(centerX + side * spread, y, radius, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Runway designation near the far end
    ctx.fillStyle = night ? "#e8e8dc" : "#f5f2e5";
    ctx.font = `bold ${Math.max(9, width * 0.012)}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText(runway.id, runway.topX, topY + height * 0.035);
  });

  // Rain and storm streaks
  if (["RAIN", "THUNDERSTORM"].includes(state.weather.condition)) {
    ctx.strokeStyle = "rgba(185, 211, 219, .28)";
    ctx.lineWidth = Math.max(1, width * 0.003);
    ctx.beginPath();
    ctx.moveTo(width * 0.12, height * 0.62);
    ctx.lineTo(width * 0.18, height * 0.91);
    ctx.moveTo(width * 0.85, height * 0.62);
    ctx.lineTo(width * 0.80, height * 0.94);
    ctx.stroke();
  }
}

    function drawWindsock(ctx, x, y, height, mode, timestamp) {
      ctx.strokeStyle = mode === "night" ? "#9caaad" : "#46534f";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - height);
      ctx.stroke();
      const flick = Math.sin(timestamp / 650) * height * 0.08;
      ctx.fillStyle = "#d47b60";
      ctx.beginPath();
      ctx.moveTo(x, y - height);
      ctx.lineTo(x + height * 0.55 + flick, y - height * 0.9);
      ctx.lineTo(x + height * 0.42 + flick, y - height * 0.7);
      ctx.lineTo(x, y - height * 0.78);
      ctx.closePath();
      ctx.fill();
    }

  function drawRadar() {
      const size = fitCanvas();
      if (!size) return;
      const { width, height } = size;
      context.clearRect(0, 0, width, height);
      context.fillStyle = "#081723";
      context.fillRect(0, 0, width, height);
      context.lineWidth = 1;
      const scale = Math.min(width, height) / (radarRangeNm * 2);
      document.querySelector(".radar-range").style.width = `${10 * scale}px`;
      document.querySelector(".radar-range").textContent = `${radarRangeNm} NM`;
      for (let nm = 10; nm <= radarRangeNm; nm += 10) {
        context.beginPath();
        context.arc(width / 2, height / 2, nm * scale, 0, Math.PI * 2);
        context.strokeStyle = nm === 20 ? "#253c4a" : "#1d303e";
        context.stroke();
      }
    context.strokeStyle = "#1c303d";
    context.setLineDash([2, 7]);
    for (let i = 1; i < 8; i += 1) {
      const x = width * i / 8;
      const y = height * i / 6;
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
      if (i < 6) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
    }
    context.setLineDash([]);

    drawWeatherHazard(width, height, scale);
    drawRadarSweep(width, height, scale);
    for (const plane of state.aircraft) drawRoute(plane, width, height);
    for (const pair of state.conflicts) drawConflict(pair, width, height);
    drawAirportMarker(width, height);
    for (const plane of state.aircraft) drawAircraft(plane, width, height);
  }

  function drawAirportMarker(width, height) {
    const point = toCanvas(AIRPORT_POINT, width, height);
    context.beginPath();
    context.arc(point.x, point.y, 4, 0, Math.PI * 2);
    context.fillStyle = "#f0c879";
    context.fill();
    context.strokeStyle = "#152b37";
    context.lineWidth = 1;
    context.stroke();
    context.fillStyle = "#f0dba9";
    context.font = "700 8px monospace";
    context.textAlign = point.x > width - 52 ? "right" : "left";
    context.fillText("AIRPORT", point.x + (context.textAlign === "left" ? 7 : -7), point.y - 7);
    context.textAlign = "start";
  }

  function drawRadarSweep(width, height) {
    const angle = state.simTime / 18;
    const radius = Math.min(width, height) / 2;
    context.save();
    context.translate(width / 2, height / 2);
    context.rotate(angle);
    const sweep = context.createRadialGradient(0, 0, 1, 0, 0, radius);
    sweep.addColorStop(0, "rgba(107, 187, 209, 0)");
    sweep.addColorStop(1, "rgba(107, 187, 209, .11)");
    context.fillStyle = sweep;
    context.beginPath();
    context.moveTo(0, 0);
    context.arc(0, 0, radius, -0.22, 0.02);
    context.closePath();
    context.fill();
    context.restore();
  }

  function drawWeatherHazard(width, height, scale) {
    if (!state.weather.hazard) return;
    const hazard = toCanvas(state.weather.hazard, width, height);
    context.beginPath();
    context.arc(hazard.x, hazard.y, state.weather.hazard.radius * scale, 0, Math.PI * 2);
    context.fillStyle = "rgba(188, 116, 89, .12)";
    context.fill();
    context.strokeStyle = "#ba8068";
    context.setLineDash([5, 4]);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = "#e0ac8b";
    context.font = "8px monospace";
    context.fillText("STORM", hazard.x + 7, hazard.y - 6);
  }

  function drawRoute(plane, width, height) {
    const start = toCanvas(plane, width, height);
    context.beginPath();
    context.moveTo(start.x, start.y);
    for (let index = plane.routeIndex; index < plane.route.length; index += 1) {
      const point = toCanvas(plane.route[index], width, height);
      context.lineTo(point.x, point.y);
    }
    context.strokeStyle = plane.id === state.selectedId ? "#8bcfe1" : "#607987";
    context.lineWidth = plane.id === state.selectedId ? 1.5 : 1;
    context.setLineDash([4, 4]);
    context.stroke();
    context.setLineDash([]);
    if (plane.cleared && !plane.arrived) {
      const future = futurePosition(plane, 180);
      const projection = toCanvas(future, width, height);
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(projection.x, projection.y);
      context.strokeStyle = "#79c9e4";
      context.setLineDash([2, 3]);
      context.stroke();
      context.setLineDash([]);
    }
  }

  function drawConflict(pair, width, height) {
    const a = toCanvas(pair.first, width, height);
    const b = toCanvas(pair.second, width, height);
    context.beginPath();
    context.moveTo(a.x, a.y);
    context.lineTo(b.x, b.y);
    context.strokeStyle = "#d9a95e";
    context.lineWidth = 1;
    context.setLineDash([3, 3]);
    context.stroke();
    context.setLineDash([]);
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    context.beginPath();
    context.arc(midX, midY, 9, 0, Math.PI * 2);
    context.strokeStyle = "#e5b35f";
    context.stroke();
  }

  function drawAircraft(plane, width, height) {
    const point = toCanvas(plane, width, height);
    const selected = plane.id === state.selectedId;
    const conflict = state.conflicts.some((pair) => pair.first === plane || pair.second === plane);
    const angle = plane.heading * Math.PI / 180;
    if (plane.trail.length > 1) {
      context.beginPath();
      plane.trail.forEach((item, index) => {
        const p = toCanvas(item, width, height);
        index ? context.lineTo(p.x, p.y) : context.moveTo(p.x, p.y);
      });
      context.strokeStyle = "rgba(119, 169, 187, .38)";
      context.lineWidth = 1;
      context.stroke();
    }
    if (selected) {
      context.beginPath();
      context.arc(point.x, point.y, 13, 0, Math.PI * 2);
      context.strokeStyle = "#79c9e4";
      context.lineWidth = 1;
      context.stroke();
    }
    context.save();
    context.translate(point.x, point.y);
    context.rotate(angle);
    context.beginPath();
    context.moveTo(0, -8);
    context.lineTo(5, 6);
    context.lineTo(0, 4);
    context.lineTo(-5, 6);
    context.closePath();
    context.fillStyle = conflict ? "#e5b35f" : plane.cleared ? "#dbe9f0" : "#8599a5";
    context.fill();
    context.restore();
    const labelRight = point.x >= width / 2;
    const labelX = point.x + (labelRight ? 9 : -9);
    context.textAlign = labelRight ? "left" : "right";
    context.fillStyle = selected ? "#e9f7fc" : "#b6c7d0";
    context.font = "10px monospace";
    context.fillText(plane.id, labelX, point.y - 8);
    context.fillStyle = "#8ea5b2";
    context.font = "8px monospace";
    context.fillText(`${Math.round(plane.altitude / 100) * 100}`, labelX, point.y + 3);
    context.textAlign = "start";
  }

  function canvasAircraftAt(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (Math.hypot(x - rect.width / 2, y - rect.height / 2) > Math.min(rect.width, rect.height) / 2) return null;
    return state.aircraft.filter((plane) => Math.hypot(plane.x, plane.y) <= radarRangeNm).map((plane) => {
      const position = toCanvas(plane, rect.width, rect.height);
      return { plane, delta: Math.hypot(x - position.x, y - position.y) };
    }).sort((a, b) => a.delta - b.delta).find((entry) => entry.delta < 20)?.plane;
  }

  function shiftGrade() {
    if (state.emergenciesFailed || state.collisions) return "F";
    const expectedScore = Math.floor(state.realTime / 10) * 10 +
      state.departures * 25 + state.arrivals * 25 +
      (state.emergenciesResolved + state.emergenciesFailed) * 100 +
      state.routeDecisions * 15;
    const ratio = expectedScore ? state.score / expectedScore : 1;
    if (ratio >= 0.97) return "A+";
    if (ratio >= 0.93) return "A";
    if (ratio >= 0.9) return "A-";
    if (ratio >= 0.87) return "B+";
    if (ratio >= 0.83) return "B";
    if (ratio >= 0.8) return "B-";
    if (ratio >= 0.75) return "C+";
    if (ratio >= 0.7) return "C";
    if (ratio >= 0.65) return "C-";
    if (ratio >= 0.6) return "D";
    return "F";
  }

  function shiftSuggestions(collision) {
    if (collision) return "Review radar routes and predicted separation before releasing or clearing aircraft.";
    if (state.endReason.includes("timed out")) return "Review the weather and conflict alerts early, and use the command reference before an emergency occurs.";
    if (state.safeDepartures < state.departures) return "Check runway demand, weather, and separation before authorizing each takeoff.";
    if (state.safeArrivals < state.arrivals) return "Give arriving aircraft clear runway spacing and monitor visibility.";
    if (!state.efficientRoutes) return "Compare route distance and estimated fuel, then use safe shortcuts when available.";
    return "Keep monitoring runway demand and predicted separation as traffic changes.";
  }

  
function endShift(collision, reason = "") {
    if (state.finished) return;
    state.finished = true;
    state.paused = true;
    state.gameOver = collision;
    state.endReason = reason || (collision
      ? `Collision involving ${collision.first.id} and ${collision.second.id}.`
      : "Shift ended.");

    if (collision) {
      state.collisions += 1;
      state.aircraftLost += 2;
    }

    state.weatherEmergency = null;
    $("emergency-alert").hidden = true;
    $("emergency-command-input").value = "";
    if ($("results-dialog").open) $("results-dialog").close();
    if ($("rules-dialog").open) $("rules-dialog").close();
    state.reportOpen = false;

    const totals = metrics();
    const grade = shiftGrade();
    const duration = formatClock(state.simTime);

    $("results-kicker").textContent = "GAME OVER";
    $("results-title").textContent = "Current Shift Report";
    $("results-summary").textContent = state.endReason;
    $("results-grid").replaceChildren(
      resultCell("Final score", `${state.score} points`),
      resultCell("Overall grade", grade),
      resultCell("Shift duration", `${duration} simulated`),
      resultCell("Safe departures", `${state.safeDepartures} / ${state.departures}`),
      resultCell("Safe arrivals", `${state.safeArrivals} / ${state.arrivals}`),
      resultCell("Emergencies resolved", String(state.emergenciesResolved)),
      resultCell("Emergencies failed", String(state.emergenciesFailed)),
      resultCell("Collisions", String(state.collisions)),
      resultCell("Aircraft lost", String(state.aircraftLost)),
      resultCell("Estimated distance", `${totals.distanceNm.toFixed(1)} NM`),
      resultCell("Estimated fuel use", `${Math.round(totals.fuelKg).toLocaleString()} kg`),
      resultCell("Estimated CO₂ emissions", `${Math.round(totals.co2Kg).toLocaleString()} kg`)
    );

    $("results-feedback").textContent = `Suggestion: ${shiftSuggestions(collision)}`;
    $("results-caveat").textContent = "Aircraft operations, outcomes, fuel, and emissions are simulated estimates only. This is not operational guidance.";
    $("play-again").textContent = "RESTART SHIFT";
    $("play-again").setAttribute("aria-label", "Restart shift");
    $("pause-button").textContent = "Paused";
    $("pause-button").disabled = true;

    renderUI();

    const crashCutscene = $("crash-cutscene");
    crashCutscene.hidden = false;
    crashCutscene.setAttribute("aria-hidden", "false");
    crashCutscene.classList.remove("playing");
    void crashCutscene.offsetWidth;
    crashCutscene.classList.add("playing");

    crashCutsceneTimer = setTimeout(() => {
      crashCutscene.hidden = true;
      crashCutscene.setAttribute("aria-hidden", "true");
      crashCutscene.classList.remove("playing");
      crashCutsceneTimer = null;
      $("results-dialog").showModal();
    }, 3000);
  }

  function resultCell(label, value) {
    const item = document.createElement("div");
    item.className = "result-cell";
    const title = document.createElement("span");
    title.textContent = label;
    const output = document.createElement("strong");
    output.textContent = value;
    item.append(title, output);
    return item;
  }

  function emergencyCommandAccuracy() {
    if (!state.emergencyAttempts) return "No responses";
    const percentage = Math.round(state.emergencyCommandMatches / state.emergencyAttempts * 100);
    return `${state.emergencyCommandMatches}/${state.emergencyAttempts} (${percentage}%)`;
  }

  function openShiftReport() {
    const totals = metrics();
    const routeDelta = totals.distanceNm - state.shiftStartDistance;
    $("results-title").textContent = "Shift report";
    $("results-kicker").textContent = "SHIFT SUMMARY";
    $("results-summary").textContent = "A summary of this synthetic shift so far. Opening this report does not pause traffic.";
    $("results-grid").replaceChildren(
      resultCell("Current score", `${state.score} points`),
      resultCell("Current grade", shiftGrade()),
      resultCell("Shift duration", `${formatClock(state.simTime)} simulated`),
      resultCell("Departures", String(state.departures)),
      resultCell("Arrivals", String(state.arrivals)),
      resultCell("Safe departures", `${state.safeDepartures} / ${state.departures}`),
      resultCell("Safe arrivals", `${state.safeArrivals} / ${state.arrivals}`),
      resultCell("Emergencies resolved", String(state.emergenciesResolved)),
      resultCell("Emergencies failed", String(state.emergenciesFailed)),
      resultCell("Conflicts detected", String(state.conflictEvents)),
      resultCell("Alerts cleared", String(state.resolvedPairs.size)),
      resultCell("Emergency command accuracy", emergencyCommandAccuracy()),
      resultCell("Runway demand alerts", String(state.runwayEvents)),
      resultCell("Accumulated delay", `${Math.round(state.delaySeconds / 60)} min`),
      resultCell("Route distance vs start", `${routeDelta >= 0 ? "+" : ""}${routeDelta.toFixed(1)} NM`),
      resultCell("Estimated fuel", `${Math.round(totals.fuelKg).toLocaleString()} kg`),
      resultCell("Estimated CO₂", `${Math.round(totals.co2Kg).toLocaleString()} kg`)
    );
    $("results-feedback").textContent = `Fuel is estimated at 8 kg/NM and CO₂ at 3.16 kg/kg fuel. ${state.efficientRoutes} safe route shortcut(s) reduced route distance. These are illustrative factors, not measured consumption.`;
    $("results-caveat").textContent = "Aircraft and separation are simulated. Estimates are educational, not operational guidance or guaranteed savings.";
    $("play-again").textContent = "Close report";
    state.reportOpen = true;
    $("results-dialog").show();
  }

  function openTutorial() {
    if (state.weatherEmergency) {
      setMessage("Finish the active emergency before opening the tutorial.", "warning");
      return;
    }
    tutorialWasPaused = state.paused;
    state.paused = true;
    tutorialIndex = -1;
    $("tutorial-overlay").hidden = false;
    $("tutorial-welcome-actions").hidden = false;
    $("tutorial-step-actions").hidden = true;
    $("tutorial-progress").textContent = "WELCOME";
    $("tutorial-title").textContent = "WELCOME TO TOWER CONTROL";
    $("tutorial-copy").textContent = "Would you like a quick tutorial before starting?";
    clearTutorialTarget();
    $("tutorial-start").focus();
    renderUI();
  }

  function showTutorialStep(index) {
    tutorialIndex = index;
    const step = TUTORIAL_STEPS[index];
    $("tutorial-welcome-actions").hidden = true;
    $("tutorial-step-actions").hidden = false;
    $("tutorial-progress").textContent = `STEP ${index + 1} OF ${TUTORIAL_STEPS.length}`;
    $("tutorial-title").textContent = step.title;
    $("tutorial-copy").textContent = step.text;
    $("tutorial-back").hidden = index === 0;
    $("tutorial-next").textContent = index === TUTORIAL_STEPS.length - 1 ? "Start shift" : "Next";
    clearTutorialTarget();
    tutorialTarget = step.selector ? document.querySelector(step.selector) : null;
    if (tutorialTarget) {
      tutorialTarget.classList.add("tutorial-highlight");
      tutorialTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    $("tutorial-next").focus();
    requestAnimationFrame(drawTutorialConnector);
  }

  function drawTutorialConnector() {
    const svg = $("tutorial-connector");
    const path = $("tutorial-connector-path");
    const card = document.querySelector(".tutorial-card");
    svg.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
    if (!tutorialTarget || !card || $("tutorial-overlay").hidden) {
      path.setAttribute("d", "");
      return;
    }
    const target = tutorialTarget.getBoundingClientRect();
    const box = card.getBoundingClientRect();
    path.setAttribute("d", `M ${box.left + box.width / 2} ${box.bottom} L ${target.left + target.width / 2} ${target.top}`);
  }

  function clearTutorialTarget() {
    tutorialTarget?.classList.remove("tutorial-highlight");
    tutorialTarget = null;
    $("tutorial-connector-path").setAttribute("d", "");
  }

  function closeTutorial(startShift = false) {
    $("tutorial-overlay").hidden = true;
    clearTutorialTarget();
    if (startShift) {
      resetShift();
      state.paused = false;
    } else {
      state.paused = tutorialWasPaused;
    }
    renderUI();
    $("open-tutorial").focus();
  }

  $("tutorial-overlay").addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const card = $("tutorial-overlay").querySelector(".tutorial-card");
    const buttons = [...card.querySelectorAll("button:not(:disabled)")]
      .filter((button) => !button.closest("[hidden]"));
    if (!buttons.length) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && (document.activeElement === first || !card.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !card.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  });

  function showFirstVisitTutorial() {
    openTutorial();
  }

  function tick(timestamp) {
    if (!state.lastFrame) state.lastFrame = timestamp;
    const elapsed = Math.min(0.05, Math.max(0, (timestamp - state.lastFrame) / 1000));
    state.lastFrame = timestamp;
    if (!state.paused && !state.finished) {
      state.airportTime += elapsed * 1000;
      state.realTime += elapsed;
      updateMovement(elapsed * state.speed);
      analyzeConflicts();
      const safeTraffic = !state.weatherEmergency && !state.finished &&
        state.conflicts.length === 0 && !state.aircraft.some(aircraftWeatherRisk);
      if (safeTraffic) {
        state.scoreTimeRemainder += elapsed;
        while (state.scoreTimeRemainder >= 10) {
          state.scoreTimeRemainder -= 10;
          awardPoints(10);
        }
      }
      if (timestamp - state.lastUiUpdate > 180) {
        renderUI();
        state.lastUiUpdate = timestamp;
      }
    }
    updateWeatherEmergency();
    drawRadar();
    drawAirport(state.airportTime);
    requestAnimationFrame(tick);
  }

  $("pause-button").addEventListener("click", () => {
    if (state.finished || state.weatherEmergency) return;
    state.paused = !state.paused;
    $("pause-button").textContent = state.paused ? "Resume" : "Pause";
    $("pause-button").setAttribute("aria-pressed", String(state.paused));
    renderUI();
  });
  $("restart-button").addEventListener("click", () => {
    resetShift();
  });
  $("speed-select").addEventListener("change", (event) => {
    const speed = Number(event.target.value);
    if ([15, 30, 60].includes(speed)) state.speed = speed;
  });
  $("radar-range").addEventListener("change", (event) => {
    const range = Number(event.target.value);
    if ([20, 40, 60].includes(range)) {
      radarRangeNm = range;
      drawRadar();
    }
  });
  $("time-of-day").addEventListener("change", (event) => {
    if (["day", "sunset", "night"].includes(event.target.value)) {
      airportLighting = event.target.value;
      drawAirport(state.airportTime);
    }
  });
  $("open-tutorial").addEventListener("click", openTutorial);
  $("tutorial-start").addEventListener("click", () => showTutorialStep(0));
  $("tutorial-skip-welcome").addEventListener("click", () => closeTutorial(false));
  $("tutorial-skip").addEventListener("click", () => closeTutorial(false));
  $("tutorial-back").addEventListener("click", () => showTutorialStep(Math.max(0, tutorialIndex - 1)));
  $("tutorial-next").addEventListener("click", () => {
    if (tutorialIndex >= TUTORIAL_STEPS.length - 1) closeTutorial(true);
    else showTutorialStep(tutorialIndex + 1);
  });
  window.addEventListener("resize", drawTutorialConnector);
  window.addEventListener("scroll", drawTutorialConnector, true);
  $("open-rules").addEventListener("click", () => {
    if (!state.weatherEmergency) $("rules-dialog").showModal();
  });
  $("close-rules").addEventListener("click", () => $("rules-dialog").close());
  $("shift-report").addEventListener("click", () => {
    if (state.weatherEmergency) return;
    openShiftReport();
  });
  $("emergency-form").addEventListener("submit", submitEmergencyResponse);
  $("close-results").addEventListener("click", () => {
    $("results-dialog").close();
    state.reportOpen = false;
  });
  $("play-again").addEventListener("click", () => {
    if (state.reportOpen) {
      $("results-dialog").close();
      state.reportOpen = false;
    } else {
      resetShift();
    }
  });
  canvas.addEventListener("click", (event) => {
    const plane = canvasAircraftAt(event);
    if (plane) selectAircraft(plane.id);
  });
  canvas.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      const plane = state.aircraft.find((item) => item.id === state.selectedId);
      if (plane) {
        event.preventDefault();
        const index = state.aircraft.indexOf(plane);
        selectAircraft(state.aircraft[(index + 1) % state.aircraft.length].id);
      }
    }
  });
  window.addEventListener("resize", () => {
    drawRadar();
    drawAirport();
  });

  resetShift();
  drawAirport();
  showFirstVisitTutorial();
  requestAnimationFrame(tick);
})();
