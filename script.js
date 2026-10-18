(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const cityMapElement = $("city-map");
  const mapLoadStatus = $("map-load-status");
  const airportCanvas = $("airport-view");
  const airportContext = airportCanvas.getContext("2d");
  const HORIZON_SECONDS = 8 * 60;
  const HORIZONTAL_LIMIT_NM = 5;
  const VERTICAL_LIMIT_FT = 1000;
  const COLLISION_LIMIT_NM = 0.3;
  const COLLISION_VERTICAL_FT = 500;
  const TAKEOFF_DURATION_SECONDS = 4;
  const SHIFT_GOAL_PLANES = 15;
  const RUNWAY_OCCUPANCY_SECONDS = 30;
  const MAX_LOCAL_AIRCRAFT = 10;
  const MIN_LOCAL_AIRCRAFT = 5;
  const RUNWAY_COOLDOWN_SECONDS = 10;
  const GATE_TIMEOUT_SECONDS = 120;
  const SPEED_BOOST = 5;
  const HAZARD_PERIOD_SECONDS = 25;
  const HAZARD_DURATION_SECONDS = 5;
  const STORM_CROSS_SECONDS = 22;
  const RETURN_DELAY_SECONDS = 50;
  const CANCEL_PENALTY = 50;
  const MAX_WRONG_RESPONSES = 3;
  const EMERGENCY_RESPONSE_MS = 10000;
  const FUEL_KG_PER_NM = 8;
  const CO2_KG_PER_KG_FUEL = 3.16;
  let airportLighting = "day";
  const AIRPORT_GEO = { lat: 43.6777, lon: -79.6248, name: "TORONTO PEARSON", country: "CANADA" };
  const AIRSPACE_BOUNDS = [[43.45, -79.95], [43.9, -79.3]];
  const RADAR_BOUNDS = [[43.44, -79.92], [43.91, -79.31]];
  const WAYPOINTS = {
    NORTHWEST: { x: -7, y: 6 },
    NORTHEAST: { x: 8, y: 6 },
    DOWNTOWN: { x: 8, y: -1 },
    WEST: { x: -6, y: -6 },
    SOUTHEAST: { x: 11, y: -8 },
    NORTH: { x: 1, y: 7 },
    SOUTHWEST: { x: -5, y: -8 }
  };
  const WAYPOINT_LABELS = {
    NORTHWEST: "NORTHWEST FIX",
    NORTHEAST: "NORTHEAST FIX",
    DOWNTOWN: "DOWNTOWN FIX",
    WEST: "WEST FIX",
    SOUTHEAST: "SOUTHEAST FIX",
    NORTH: "NORTH FIX",
    SOUTHWEST: "SOUTHWEST FIX"
  };
  const DESTINATION_GEOGRAPHY = {
    MILTON: { lat: 43.52, lon: -79.88, region: "MILTON" },
    CALEDON: { lat: 43.87, lon: -79.85, region: "CALEDON" },
    SCARBOROUGH: { lat: 43.76, lon: -79.32, region: "SCARBOROUGH" },
    OAKVILLE: { lat: 43.47, lon: -79.75, region: "OAKVILLE" },
    TORONTOISLAND: { lat: 43.6275, lon: -79.3962, region: "TORONTO ISLAND · CYTZ" },
    VAUGHAN: { lat: 43.83, lon: -79.5, region: "VAUGHAN" },
    MARKHAM: { lat: 43.8625, lon: -79.37, region: "MARKHAM · CYKZ" },
    BRAMPTON: { lat: 43.7619, lon: -79.875, region: "BRAMPTON · CYPV" }
  };
  const DESTINATIONS = Object.fromEntries(Object.entries(DESTINATION_GEOGRAPHY).map(([name, place]) => [
    name,
    { name, ...place, ...geographicToLocalNm(place.lat, place.lon) }
  ]));
  const DESTINATION_LABELS = {
    OAKVILLE: "OAKVILLE", MILTON: "MILTON", CALEDON: "CALEDON", SCARBOROUGH: "SCARBOROUGH", TORONTOISLAND: "TORONTO ISLAND",
    VAUGHAN: "VAUGHAN", MARKHAM: "MARKHAM", BRAMPTON: "BRAMPTON"
  };
  const AIRPORT_POINT = { x: 0, y: 0 };
  const RUNWAYS = [
    { id: "09", heading: 90, point: { x: -0.8, y: 0 }, screenNear: { x: 0.17, y: 0.56 }, screenFar: { x: 0.17, y: 0.39 } },
    { id: "18", heading: 0, point: { x: 0, y: 0 }, screenNear: { x: 0.50, y: 0.56 }, screenFar: { x: 0.50, y: 0.39 } },
    { id: "27", heading: 270, point: { x: 0.8, y: 0 }, screenNear: { x: 0.83, y: 0.56 }, screenFar: { x: 0.83, y: 0.39 } }
  ];
  const RUNWAY_USE_STAGES = new Set(["takeoff", "landing"]);
  const runwayPoint = (id) => RUNWAYS.find((runway) => runway.id === id)?.point || AIRPORT_POINT;
  const runwayDefinition = (id) => RUNWAYS.find((runway) => runway.id === id) || RUNWAYS[1];
  const SHIFT_DEPARTURES = [
    { id: "AC102", route: ["DOWNTOWN", "TORONTOISLAND"], altitude: 7000, speed: 495, airline: "Northstar Air", type: "A220", origin: "TORONTO PEARSON" },
    { id: "AC205", route: ["WEST", "OAKVILLE"], altitude: 6000, speed: 470, airline: "Pacific Link", type: "E190", origin: "TORONTO PEARSON" },
    { id: "AC318", route: ["NORTHEAST", "MARKHAM"], altitude: 8000, speed: 520, airline: "Northstar Air", type: "A320", origin: "TORONTO PEARSON" },
    { id: "AC427", route: ["NORTHWEST", "BRAMPTON"], altitude: 5000, speed: 465, airline: "Maple Regional", type: "Q400", origin: "TORONTO PEARSON" },
    { id: "AC536", route: ["NORTH", "VAUGHAN"], altitude: 7000, speed: 490, airline: "Maple Regional", type: "A220", origin: "TORONTO PEARSON" },
    { id: "AC641", route: ["SOUTHWEST", "MILTON"], altitude: 6000, speed: 500, airline: "Pacific Link", type: "E190", origin: "TORONTO PEARSON" },
    { id: "AC752", route: ["NORTHWEST", "CALEDON"], altitude: 7000, speed: 480, airline: "Northstar Air", type: "A320", origin: "TORONTO PEARSON" },
    { id: "AC863", route: ["DOWNTOWN", "SCARBOROUGH"], altitude: 6000, speed: 510, airline: "Maple Regional", type: "Q400", origin: "TORONTO PEARSON" }
  ];
  const SHIFT_ARRIVALS = [
    { id: "IN711", x: -11, y: 10, heading: 135, altitude: 5500, speed: 405, route: ["NORTHWEST"], airline: "Maple Regional", type: "A220", origin: "NORTHWEST AIRSPACE" },
    { id: "IN824", x: 12, y: -10, heading: 333, altitude: 6000, speed: 420, route: ["SOUTHEAST"], airline: "Northstar Air", type: "A320", origin: "SOUTHEAST AIRSPACE" },
    { id: "IN936", x: -12, y: -10, heading: 74, altitude: 6500, speed: 435, route: ["SOUTHWEST"], airline: "Pacific Link", type: "Q400", origin: "SOUTHWEST AIRSPACE" },
    { id: "IN412", x: 0, y: 12, heading: 169, altitude: 5500, speed: 405, route: ["NORTH"], airline: "Northstar Air", type: "E190", origin: "NORTH AIRSPACE" },
    { id: "IN518", x: 12, y: 10, heading: 225, altitude: 6000, speed: 420, route: ["NORTHEAST"], airline: "Maple Regional", type: "A220", origin: "NORTHEAST AIRSPACE" },
    { id: "IN623", x: -13, y: 0, heading: 131, altitude: 6500, speed: 435, route: ["WEST"], airline: "Pacific Link", type: "A320", origin: "WEST AIRSPACE" },
    { id: "IN745", x: 3, y: -12, heading: 63, altitude: 5500, speed: 405, route: ["SOUTHEAST"], airline: "Northstar Air", type: "Q400", origin: "SOUTHEAST AIRSPACE" }
  ];
  const TUTORIAL_STEPS = [
    { selector: null, title: "Your shift", text: "You are the air traffic controller at Toronto Pearson. Keep planes apart, avoid storms, and keep emissions low. Three errors end the shift." },
    { selector: ".map-goal", title: "Your goal: PLANES", text: "The PLANES counter at the top of the radar tracks your goal. Safely handle 15 planes (take-offs plus landings) to complete the shift and win. Three errors or a collision ends the game early." },
    { selector: '[data-tutorial="map"]', title: "Read the radar", text: "Green planes are yours. Dim grey planes are overflights: other airlines just passing through the sky to make it feel like a busy, real airspace. You can't control them, they can't crash into your planes, and they steer around storms on their own. A red ring means two planes are on course to meet." },
    { selector: '[data-tutorial="traffic"]', title: "Planes: READY or IN THE AIR", text: "READY planes wait at the airport. IN THE AIR planes are flying. Click any plane to select it." },
    { selector: '[data-tutorial="flight-actions"]', title: "Take off and land", text: "Select a ready plane, pick a runway, then press TAKE OFF to earn $5. For incoming IN planes, press CLEAR TO LAND so they can land. Each runway needs 10 seconds to cool down." },
    { selector: null, title: "Danger alerts", text: "When planes will collide or a storm approaches, a banner shows a countdown based on the real time to impact. Click it, then choose the reroute or type the command in time. Missing it, a wrong answer or running out of time adds an error (1/3, 2/3, 3/3)." },
    { selector: "#co2-meter", title: "CO₂ emission bar", text: "This bar adds up the emissions of every plane you send out, from green (low) to red (high). Each take-off adds 30 to it and planes in the air keep it raised, while it drains slowly at 0.5 per second (once it maxes out it drops 10% per second until it reaches 0). Balance how many planes you release in a short time. If it maxes out you get \"TOO MUCH CO₂ EMISSION!!!\" and lose 100 points. Real airports manage emissions the same way, by spacing out flights." },
    { selector: "#shop-sign", title: "Shop", text: "Money earned from take-offs ($5 each) and resolved emergencies can be spent here. Buy runway upgrades or a worker who takes off planes for you. Your purchases are saved between shifts." },
    { selector: "#open-learn", title: "Learn", text: "Open Learn for simple facts about how aviation, safety and sustainability connect." },
    { selector: ".score-counter", title: "Scoring", text: "Points come from safe flying, take-offs, landings and resolving emergencies. Good luck, controller!" }
  ];
  const state = {
    emission: 0,
    aircraft: [],
    ambient: [],
    returning: [],
    selectedRunway: null,
    completedFlights: [],
    selectedId: null,
    simTime: 0,
    airportTime: 0,
    realTime: 0,
    paused: false,
    finished: false,
    conflicts: [],
    resolvedPairs: new Set(),
    history: [],
    departures: 0,
    arrivals: 0,
    emergencyAttempts: 0,
    emergencyActionsResolved: 0,
    delaySeconds: 0,
    conflictEvents: 0,
    runwayEvents: 0,
    score: 0,
    scoreTimeRemainder: 0,
    safeDepartures: 0,
    safeArrivals: 0,
    emergenciesResolved: 0,
    emergenciesFailed: 0,
    wrongResponses: 0,
    collisions: 0,
    aircraftLost: 0,
    routeDecisions: 0,
    efficientRoutes: 0,
    endReason: "",
    scheduledIndex: 0,
    runwaySelectionCursor: 0,
    runways: {},
    nextTrafficAt: 12,
    activeConflictKeys: new Set(),
    commandConflictSnapshot: new Set(),
    reportOpen: false,
    gameOver: null,
    weather: { condition: "CLEAR", direction: 270, speed: 0, visibility: 10, warning: "No active weather advisories." },
    weatherEmergency: null,
    pendingEmergency: null,
    departuresPaused: false,
    emergencyKeys: new Set(),
    lastCommand: "",
    shiftStartDistance: 0,
    lastFrame: 0,
    lastUiUpdate: 0
  };
  let cityMap = null;
  let aircraftMarkers = new Map();
  let routeLayers = new Map();
  let weatherLayer = null;
  let conflictLayers = new Map();
  let tutorialIndex = -1;
  let tutorialWasPaused = false;
  let tutorialTarget = null;
  let cutsceneTimer = null;

  function normalizeLongitude(longitude) {
    return ((longitude + 180) % 360 + 360) % 360 - 180;
  }

  function geographicToLocalNm(latitude, longitude) {
    const deltaLongitude = normalizeLongitude(longitude - AIRPORT_GEO.lon);
    return {
      x: deltaLongitude * 60 * Math.cos(AIRPORT_GEO.lat * Math.PI / 180),
      y: (latitude - AIRPORT_GEO.lat) * 60
    };
  }

  function localNmToGeographic(point) {
    return {
      lon: normalizeLongitude(AIRPORT_GEO.lon + point.x / (60 * Math.cos(AIRPORT_GEO.lat * Math.PI / 180))),
      lat: AIRPORT_GEO.lat + point.y / 60
    };
  }

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
      delaySeconds: 0, runwayRemaining: 0
    };
  }

  function createDeparture(template) {
    const item = flight(template.id, AIRPORT_POINT.x, AIRPORT_POINT.y, 0, template.altitude, template.speed, template.route[0], template.route[1]);
    item.stage = "gate";
    item.template = template;
    item.departure = true;
    item.cleared = false;
    item.cruiseAltitude = template.altitude;
    item.altitude = 0;
    item.targetAltitude = 0;
    item.airline = template.airline;
    item.aircraftType = template.type;
    item.origin = template.origin;
    item.route = template.route.map((name) => ({ name, ...(WAYPOINTS[name] || DESTINATIONS[name]) }));
    const destination = DESTINATIONS[template.route.at(-1)];
    item.destinationName = destination
      ? destination.region
      : destinationLabel(template.route.at(-1));
    return item;
  }

  function createArrival(template) {
    const approachFix = WAYPOINTS[template.route[0]];
    const item = flight(template.id, template.x, template.y, template.heading, template.altitude, template.speed, template.route[0], "SOUTH");
    item.stage = "holding";
    item.departure = false;
    item.cleared = false;
    item.runwayId = "18";
    item.route = [{ name: template.route[0], ...approachFix }, { name: "RUNWAY 18", ...runwayPoint(item.runwayId) }];
    item.routeIndex = 0;
    // Arrivals fly at the same level band as departures so crossing paths can really collide.
    item.altitude = 6500;
    item.targetAltitude = template.approachAltitude ?? 6500;
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
    const clear = { condition: "CLEAR", direction: 270, speed: 0, visibility: 10, warning: "No active weather advisories." };
    const storm = { condition: "THUNDERSTORM", direction: 230, speed: 28, visibility: 2, warning: "Thunderstorms nearby. The marked map area is unsafe for flight." };
    const hazards = [
      storm,
      { condition: "RAIN", direction: 260, speed: 14, visibility: 4, warning: "Rain is reducing visibility; arrival spacing may take longer." },
      storm,
      { condition: "CROSSWIND", direction: 240, speed: 22, visibility: 10, warning: "Crosswind is affecting runway approach and ground speed." }
    ];

    const slot = Math.floor(state.simTime / HAZARD_PERIOD_SECONDS);
    const picked = slot >= 1 ? hazards[(slot - 1) % hazards.length] : null;
    const duration = picked?.condition === "THUNDERSTORM" ? STORM_CROSS_SECONDS : HAZARD_DURATION_SECONDS;
    const elapsed = state.simTime % HAZARD_PERIOD_SECONDS;
    const active = Boolean(picked) && elapsed < duration;
    state.weather = { ...(active ? picked : clear) };
    if (state.weather.condition === "THUNDERSTORM") {
      // The storm sweeps across the whole map, then the weather returns to normal.
      const direction = slot % 2 === 0 ? 1 : -1;
      const lane = 5 * Math.sin(slot * 1.7);
      const span = 38;
      const speed = span / STORM_CROSS_SECONDS;
      state.weather.hazard = {
        x: direction * (-span / 2 + speed * elapsed),
        y: lane + 1.5 * Math.sin(elapsed / 3),
        vx: direction * speed,
        vy: 0,
        radius: 5
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
    const tickNow = performance.now();
    const pendingAlert = state.pendingEmergency;
    if (pendingAlert?.expires !== undefined) {
      // Time spent paused (dialogs, Pause button) doesn't use up the alert; it stays until it hits 0.
      if (pendingAlert.lastTick && (state.paused || state.finished)) pendingAlert.expires += tickNow - pendingAlert.lastTick;
      pendingAlert.lastTick = tickNow;
    }
    if (state.paused || state.finished) return;

    if (state.pendingEmergency) {
      const pending = state.pendingEmergency;
      // Targets that no longer exist (landed or already lost) cancel the alert; otherwise the deadline always applies.
      if (!pending.targetIds.some((id) => getPlane(id))) {
        state.pendingEmergency = null;
        state.emergencyKeys.delete(pending.key);
        return;
      }
      const now = performance.now();
      pending.expires ??= now + (pending.reactionMs ?? EMERGENCY_RESPONSE_MS);
      const left = Math.ceil((pending.expires - now) / 1000);
      $("safety-banner").querySelector(".warning-action").textContent = `RESPOND ${Math.max(0, left)}s`;
      if (now >= pending.expires) {
        pending.wasPaused = false;
        state.pendingEmergency = null;
        state.weatherEmergency = pending;
        failEmergency("You didn't click in time. The aircraft crashed.", pending);
      }
      return;
    }

    if (state.weather.condition === "THUNDERSTORM") {
      const endangered = state.aircraft.find(aircraftWeatherRisk);
      if (endangered) {
        const key = `weather:${Math.floor(state.simTime / 1500)}:${endangered.id}`;
        if (!state.emergencyKeys.has(key) && findWeatherReroute(endangered)) {
          state.emergencyKeys.add(key);
          state.pendingEmergency = {
            type: "DANGEROUS STORM",
            kind: "weather",
            key,
            targetIds: [endangered.id],
            reactionMs: reactionWindowMs(weatherImpactSeconds(endangered)),
            requiredCommand: `REROUTE ${endangered.id}`,
            explanation: `${endangered.id} is projected to enter the storm area. Rerouting changes its flight path around the marked map hazard.`
          };
          return;
        }
      }
    }

    const urgent = [...state.conflicts]
      .filter((pair) => pair.kind === "airspace" || pair.kind === "runway")
      .sort((a, b) => a.seconds - b.seconds)[0];
    if (!urgent) return;
    const key = `${urgent.kind}:${pairKey(urgent.first, urgent.second)}`;
    if (state.emergencyKeys.has(key)) return;
    if (urgent.kind === "airspace" && urgent.seconds > 25) return;

    const responseTarget = [urgent.first, urgent.second]
      .find((plane) => ["airborne", "approach"].includes(plane.stage));
    if (!responseTarget) return;
    const requiredCommand = findConflictReroute(urgent) || `HOLD ${responseTarget.id}`;
    state.emergencyKeys.add(key);
    state.pendingEmergency = {
      type: urgent.kind === "runway" ? "RUNWAY CONFLICT" : "CRITICAL AIRCRAFT CONFLICT",
      kind: "conflict",
      key,
      targetIds: [urgent.first.id, urgent.second.id],
      pairKey: key,
      reactionMs: reactionWindowMs(urgent.kind === "runway" ? 8 : urgent.seconds),
      requiredCommand,
      explanation: urgent.kind === "runway"
        ? `${urgent.first.id} and ${urgent.second.id} are approaching the same runway. Choose a course or altitude action to create space.`
        : `${urgent.first.id} and ${urgent.second.id} are on a collision course and would meet in about ${Math.max(1, Math.round(urgent.seconds))} seconds. Rerouting one aircraft can change their predicted paths.`
    };
  }

  function reactionWindowMs(secondsToImpact) {
    // The button must be pressed a little before the planes would actually meet.
    return Math.round(Math.min(25, Math.max(3, secondsToImpact - 1.5)) * 1000);
  }

  function weatherImpactSeconds(plane) {
    const hazard = state.weather.hazard;
    for (let seconds = 0; seconds <= 15; seconds += 1) {
      const storm = { x: hazard.x + hazard.vx * seconds, y: hazard.y + hazard.vy * seconds };
      if (distance(futurePosition(plane, seconds), storm) <= hazard.radius) return seconds;
    }
    return 15;
  }

  function emergencyActionOptions(emergency) {
    if (emergency.kind === "weather") {
      return [{ label: `REROUTE ${emergency.targetIds[0]}`, command: `REROUTE ${emergency.targetIds[0]}` }];
    }
    const pair = state.conflicts.find((item) =>
      `${item.kind}:${pairKey(item.first, item.second)}` === emergency.pairKey);
    if (!pair) return [];
    const options = [];
    for (const plane of [pair.first, pair.second]) {
      const waypoint = findConflictWaypoint(plane, pair);
      if (waypoint) {
        options.push({ label: `REROUTE ${plane.id}`, command: `REROUTE ${plane.id}` });
      }
    }
    for (const plane of [pair.first, pair.second]) {
      const originalHeading = plane.holdHeading;
      const originalUntil = plane.holdUntil;
      const originalDirection = plane.heading;
      for (const offset of [90, -90, 135, -135, 180]) {
        const heading = Math.round((plane.heading + offset + 360) % 360);
        plane.holdHeading = heading;
        plane.holdUntil = state.simTime + 180;
        plane.heading = heading;
        const resolves = !predictPair(pair.first, pair.second).conflict;
        plane.holdHeading = originalHeading;
        plane.holdUntil = originalUntil;
        plane.heading = originalDirection;
        if (resolves) {
          options.push({
            label: `TURN ${plane.id} · HDG ${String(heading).padStart(3, "0")}°`,
            phrase: `${offset === 180 ? "REVERSE" : Math.abs(offset) === 135 ? "SPIN" : "TURN"} ${plane.id} HDG ${String(heading).padStart(3, "0")}`,
            command: `TURN ${plane.id} HEADING ${String(heading).padStart(3, "0")}`
          });
          break;
        }
      }
    }
    for (const plane of [pair.first, pair.second]) {
      const originalAltitude = plane.targetAltitude;
      const other = plane === pair.first ? pair.second : pair.first;
      const levels = [other.altitude + 2000, other.altitude - 2000, other.targetAltitude + 2000, other.targetAltitude - 2000]
        .filter((altitude, index, all) => altitude >= 1000 && altitude <= 39000 && altitude % 1000 === 0 && all.indexOf(altitude) === index);
      for (const altitude of levels) {
        plane.targetAltitude = altitude;
        const resolves = !predictPair(pair.first, pair.second).conflict;
        plane.targetAltitude = originalAltitude;
        if (resolves) {
          options.push({
            label: `ALTITUDE ${plane.id} · ${altitude.toLocaleString()} FT`,
            phrase: `${altitude > plane.altitude ? "CLIMB" : "DIVE"} ${plane.id} ALT ${altitude}`,
            command: `SET ${plane.id} ALTITUDE ${altitude}`
          });
          break;
        }
      }
    }
    return options.slice(0, 3);
  }

  function renderEmergencyActions(emergency) {
    const holder = $("emergency-choices");
    holder.replaceChildren();
    holder.hidden = true;
    const actions = emergencyActionOptions(emergency).map((action) => ({
      ...action,
      phrase: action.phrase || action.command
    }));
    const pick = actions.filter((action) => !action.command.startsWith("REROUTE"));
    const pool = pick.length ? pick : actions;
    const fallback = emergency.requiredCommand
      ? { label: emergency.requiredCommand, command: emergency.requiredCommand, phrase: emergency.requiredCommand }
      : null;
    emergency.challenge = pool[Math.floor(Math.random() * pool.length)] || fallback;
    $("emergency-ghost").textContent = emergency.challenge?.phrase || "";
  }

  function typedMistakes(typed, target) {
    let wrong = Math.abs(typed.length - target.length);
    for (let i = 0; i < Math.min(typed.length, target.length); i += 1) {
      if (typed[i] !== target[i]) wrong += 1;
    }
    return wrong;
  }

  function submitTypedResponse() {
    const emergency = state.weatherEmergency;
    if (!emergency?.challenge) return;
    const typed = $("emergency-command").value.trim().toUpperCase();
    if (typedMistakes(typed, emergency.challenge.phrase) > 3) {
      state.emergencyAttempts += 1;
      $("emergency-command").value = "";
      failEmergency("Bad communication. The aircraft crashed.");
      return;
    }
    submitEmergencyAction(emergency.challenge.command, true);
  }

  function beginEmergency(emergency) {
    emergency.deadline = performance.now() + EMERGENCY_RESPONSE_MS;
    emergency.wasPaused = state.paused;
    state.pendingEmergency = null;
    state.weatherEmergency = emergency;
    state.paused = true;
    if ($("results-dialog").open) {
      $("results-dialog").close();
      state.reportOpen = false;
    }
    if ($("rules-dialog").open) $("rules-dialog").close();
    $("emergency-feedback").textContent = "";
    $("emergency-command").value = "";
    $("mistake-count").textContent = `${state.wrongResponses} / ${MAX_WRONG_RESPONSES}`;
    $("emergency-title").textContent = emergency.type;
    $("emergency-message").textContent = emergency.explanation;
    $("emergency-clock").textContent = "10s";
    $("emergency-alert").hidden = false;
    renderEmergencyActions(emergency);
    setMessage(`${emergency.type}. Flight movement paused for a ten-second response.`, "warning");
    renderUI();
    drawWorldMap();
    const firstAction = $("emergency-choices").querySelector("button");
    if (firstAction) firstAction.focus();
    else $("emergency-command").focus();
  }

  function updateEmergencyCountdown() {
    const emergency = state.weatherEmergency;
    if (!emergency) return;
    const remainingMs = emergency.deadline - performance.now();
    if (remainingMs > 0) {
      const seconds = Math.ceil(remainingMs / 1000);
      if ($("emergency-clock").textContent !== `${seconds}s`) {
        $("emergency-clock").textContent = `${seconds}s`;
      }
      return;
    }
    $("emergency-clock").textContent = "0s";
    if (!emergency.timeoutScheduled) {
      emergency.timeoutScheduled = true;
      $("emergency-command").disabled = true;
      $("emergency-submit").disabled = true;
      $("emergency-choices").querySelectorAll("button").forEach((button) => { button.disabled = true; });
      window.setTimeout(() => finishEmergencyTimeout(emergency), 0);
    }
  }

  function explodeAircraft(planes) {
    if (!cityMap || !window.L) return;
    for (const plane of planes) {
      const position = localNmToGeographic(plane);
      const marker = window.L.marker([position.lat, position.lon], {
        icon: window.L.divIcon({ className: "radar-explosion", html: "<i></i><b></b>", iconSize: [40, 40], iconAnchor: [20, 20] }),
        interactive: false,
        keyboard: false,
        zIndexOffset: 900
      }).addTo(cityMap);
      window.setTimeout(() => cityMap.removeLayer(marker), 1500);
    }
  }

  let strikeTimer = null;
  function showStrike(message, label) {
    const toast = $("strike-toast");
    $("strike-count").textContent = label || `ERRORS ${state.wrongResponses}/${MAX_WRONG_RESPONSES}`;
    $("strike-text").textContent = message;
    toast.hidden = false;
    window.clearTimeout(strikeTimer);
    strikeTimer = window.setTimeout(() => { toast.hidden = true; }, 6000);
  }

  function failEmergency(message, emergency = state.weatherEmergency) {
    if (!emergency || state.weatherEmergency !== emergency) return;
    const doomed = (emergency.targetIds || []).map(getPlane).filter(Boolean);
    explodeAircraft(doomed);
    state.aircraft = state.aircraft.filter((plane) => !doomed.includes(plane));
    state.aircraftLost += doomed.length;
    if (!state.aircraft.some((plane) => plane.id === state.selectedId)) state.selectedId = nextWaitingId();
    if (emergency.key) state.emergencyKeys.delete(emergency.key);
    state.emergencyAttempts += 1;
    state.emergenciesFailed += 1;
    state.wrongResponses += 1;
    $("mistake-count").textContent = `${state.wrongResponses} / ${MAX_WRONG_RESPONSES}`;
    state.weatherEmergency = null;
    $("emergency-alert").hidden = true;
    $("emergency-command").disabled = false;
    $("emergency-submit").disabled = false;
    $("emergency-command").value = "";
    if (state.wrongResponses >= MAX_WRONG_RESPONSES) {
      const pair = doomed.length > 1 ? { first: doomed[0], second: doomed[1] } : null;
      endShift(pair, `Shift lost after ${MAX_WRONG_RESPONSES} errors. ${message}`);
      return;
    }
    state.paused = emergency.wasPaused;
    showStrike(message);
    setMessage(`${message} Error ${state.wrongResponses} of ${MAX_WRONG_RESPONSES}.`, "error");
    renderUI();
    drawWorldMap();
    $("pause-button").focus();
  }

  function finishEmergencyTimeout(emergency) {
    failEmergency("You didn't assess the situation in time. The aircraft crashed.", emergency);
  }

  function submitEmergencyAction(command, typed = false) {
    const emergency = state.weatherEmergency;
    if (!emergency) return;
    if (performance.now() >= emergency.deadline) {
      updateEmergencyCountdown();
      return;
    }

    state.emergencyAttempts += 1;
    state.commandConflictSnapshot = new Set(state.activeConflictKeys);
    state.lastCommand = command;
    const result = parseCommand(command);
    if (!result.ok) {
      failEmergency("Wrong command. The aircraft crashed.");
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
      failEmergency("That command did not clear the danger. The aircraft crashed.");
      return;
    }

    state.weatherEmergency = null;
    if (emergency.key) state.emergencyKeys.add(emergency.key);
    state.paused = emergency.wasPaused;
    state.emergencyActionsResolved += 1;
    state.emergenciesResolved += 1;
    awardPoints(100);
    shop.money += 5;
    saveShop();
    renderShop();
    $("emergency-alert").hidden = true;
    $("emergency-command").disabled = false;
    $("emergency-submit").disabled = false;
    setMessage(`${result.message} The modeled danger has cleared; +100 points. Traffic resumes.`, "success");
    renderUI();
    drawWorldMap();
    $("pause-button").focus();
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
    const hazard = state.weather.hazard;
    for (const seconds of [0, 3, 6, 10, 15]) {
      const point = futurePosition(plane, seconds);
      const storm = { x: hazard.x + hazard.vx * seconds, y: hazard.y + hazard.vy * seconds };
      if (distance(point, storm) <= hazard.radius + 1.5) return true;
    }
    return false;
  }

  function groundSpeedFor(heading, airspeed) {
    const wind = state.weather;
    const downwindHeading = (wind.direction + 180) % 360;
    const relativeAngle = (heading - downwindHeading) * Math.PI / 180;
    const tailwind = Math.cos(relativeAngle) * wind.speed;
    return SPEED_BOOST * Math.max(airspeed * 0.65, Math.min(airspeed * 1.25, airspeed + tailwind));
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
    // Step both tracks forward and find the first moment they would actually collide (inside the collision box).
    // A slightly wider box than the real one allows for small course changes at waypoints.
    const WARN_NM = COLLISION_LIMIT_NM * 1.6;
    let impact = null;
    let closest = { h: Infinity, v: 0, t: 0 };
    for (let t = 0; t <= 60; t += 0.5) {
      const p = futurePosition(first, t);
      const q = futurePosition(second, t);
      const h = Math.hypot(p.x - q.x, p.y - q.y);
      const v = Math.abs(p.altitude - q.altitude);
      if (v < VERTICAL_LIMIT_FT && h < closest.h) closest = { h, v, t };
      if (h <= WARN_NM && v <= COLLISION_VERTICAL_FT * 1.5) { impact = { h, v, t }; break; }
    }
    const hit = impact || closest;
    return {
      first, second,
      seconds: impact ? impact.t : 60,
      impactSeconds: impact ? impact.t : null,
      horizontalNm: hit.h === Infinity ? distance(first, second) : hit.h,
      verticalFt: hit.v,
      conflict: Boolean(impact),
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
    if (first.runwayId !== second.runwayId) return null;
    const point = runwayPoint(first.runwayId);
    const firstApproaching = first.stage === "approach" && distance(first, point) < 3;
    const secondApproaching = second.stage === "approach" && distance(second, point) < 3;
    const firstUsingRunway = ["takeoff", "landing"].includes(first.stage);
    const secondUsingRunway = ["takeoff", "landing"].includes(second.stage);
    const sharedRunway = firstUsingRunway && secondUsingRunway;
    const runwayAndArrival = (firstUsingRunway && secondApproaching) ||
      (secondUsingRunway && firstApproaching);
    const bothApproaching = firstApproaching && secondApproaching;
    if (!(sharedRunway || runwayAndArrival || bothApproaching)) return null;
    return {
      first, second, seconds: 0, horizontalNm: distance(first, second),
      verticalFt: Math.abs(first.altitude - second.altitude),
      conflict: true, kind: "runway"
    };
  }

  function detectCollision() {
    const airborneStages = new Set(["airborne", "approach"]);
    const runwayStages = new Set(["takeoff", "landing"]);
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
            first.runwayId === second.runwayId &&
            horizontalNm <= COLLISION_LIMIT_NM) {
          const runwayUse = ["runway", "landing"].includes(first.stage) ||
            ["runway", "landing"].includes(second.stage);
          return {
            first, second, horizontalNm, verticalFt,
            cause: runwayUse
              ? `Their simulated ground movements overlapped on runway ${first.runwayId}.`
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
    drawWorldMap();
  }

  function metrics() {
    const distanceNm = [...state.completedFlights, ...state.aircraft]
      .reduce((total, plane) => total + plane.flownNm, 0);
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

  const SHOP_KEY = "airControlShop";
  const shop = (() => {
    try { return { money: 0, luxury: 0, workers: 0, ...JSON.parse(localStorage.getItem(SHOP_KEY) || "{}") }; }
    catch { return { money: 0, luxury: 0, workers: 0 }; }
  })();
  const LUXURY_BASE = 15;
  const LUXURY_NAMES = ["STANDARD", "DIAMOND", "GOLD", "RAINBOW"];
  const WORKER_PRICE = 40;
  const WORKER_COOLDOWN_SECONDS = 20;
  const luxuryPrice = () => Math.round(LUXURY_BASE * 1.5 ** shop.luxury);

  function saveShop() {
    try { localStorage.setItem(SHOP_KEY, JSON.stringify(shop)); } catch { /* storage unavailable */ }
  }

  function renderShop() {
    document.body.classList.remove("lux-1", "lux-2", "lux-3");
    if (shop.luxury) document.body.classList.add(`lux-${shop.luxury}`);
    $("shop-money").textContent = `$${shop.money}`;
    const maxed = shop.luxury >= 3;
    $("shop-luxury-level").textContent = `LEVEL ${shop.luxury}/3 · ${LUXURY_NAMES[shop.luxury]}`;
    $("shop-luxury-buy").textContent = maxed ? "MAXED" : `UPGRADE $${luxuryPrice()}`;
    $("shop-luxury-buy").disabled = maxed || shop.money < luxuryPrice();
    $("shop-workers-level").textContent = shop.workers ? "OWNED" : "NOT OWNED";
    $("shop-workers-buy").textContent = shop.workers ? "OWNED" : `BUY $${WORKER_PRICE}`;
    $("shop-workers-buy").disabled = Boolean(shop.workers) || shop.money < WORKER_PRICE;
  }

  function resetShop() {
    Object.assign(shop, { money: 0, luxury: 0, workers: 0 });
    saveShop();
    renderShop();
    workerBusy = false;
    $("worker-arm").hidden = true;
  }

  function confirmBuy(button) {
    if (button.dataset.armed) { delete button.dataset.armed; return true; }
    button.dataset.armed = "1";
    button.textContent = "CONFIRM?";
    window.setTimeout(() => { if (button.dataset.armed) { delete button.dataset.armed; renderShop(); } }, 3000);
    return false;
  }

  function buyLuxury() {
    if (shop.luxury >= 3 || shop.money < luxuryPrice() || !confirmBuy($("shop-luxury-buy"))) return;
    shop.money -= luxuryPrice();
    shop.luxury += 1;
    saveShop();
    renderShop();
  }

  function buyWorkers() {
    if (shop.workers || shop.money < WORKER_PRICE || !confirmBuy($("shop-workers-buy"))) return;
    shop.money -= WORKER_PRICE;
    shop.workers = 1;
    saveShop();
    renderShop();
  }

  let workerBusy = false;
  let workerReadyAt = 0;

  function pointArmAt(element) {
    const arm = $("worker-arm");
    const rect = element.getBoundingClientRect();
    arm.hidden = false;
    arm.style.left = `${rect.left + rect.width / 2}px`;
    arm.style.top = `${rect.top + rect.height / 2}px`;
  }

  function hideArm() {
    const arm = $("worker-arm");
    arm.style.top = "110vh";
    window.setTimeout(() => { if (!workerBusy) arm.hidden = true; }, 900);
  }

  function workerTick() {
    if (!shop.workers || workerBusy || state.paused || state.finished || state.weatherEmergency ||
        state.pendingEmergency || state.simTime < workerReadyAt) return;
    const plane = state.aircraft.find((item) => item.departure && item.stage === "gate");
    if (!plane || departureBlockReason(plane)) return;
    const runway = RUNWAYS.find((item) => runwayAvailable(plane, item.id));
    if (!runway) return;
    workerBusy = true;
    const step = (delay, action) => new Promise((resolve, reject) => window.setTimeout(() => { try { action(); resolve(); } catch (error) { reject(error); } }, delay));
    const stillWaiting = () => {
      if (!state.aircraft.includes(plane) || plane.stage !== "gate" || state.finished) throw new Error("gone");
    };
    const arm = $("worker-arm");
    arm.style.top = "110vh";
    arm.hidden = false;
    step(50, () => {
      selectAircraft(plane.id);
      const row = [...$("traffic-list").children][state.aircraft.indexOf(plane)];
      if (row) { row.scrollIntoView({ block: "nearest" }); pointArmAt(row); }
    }).then(() => step(900, () => {
      stillWaiting();
      state.selectedRunway = runway.id;
      renderUI();
      const button = [...$("runway-buttons").children].find((item) => item.textContent.includes(runway.id));
      if (button) pointArmAt(button);
    })).then(() => step(900, () => {
      stillWaiting();
      const takeoff = $("aircraft-actions").querySelector("button");
      if (takeoff) pointArmAt(takeoff);
    })).then(() => step(800, () => {
      stillWaiting();
      setMessage(`WORKER: ${authorizeDeparture(plane)}`, "success");
      renderUI();
    })).catch(() => {}).then(() => step(300, () => {
      workerBusy = false;
      workerReadyAt = state.simTime + WORKER_COOLDOWN_SECONDS;
      hideArm();
    }));
  }

  function nextWaitingId() {
    return (state.aircraft.find((plane) => plane.departure && plane.stage === "gate") || state.aircraft[0])?.id ?? null;
  }

  function awardMoney(amount, reason) {
    shop.money += amount;
    saveShop();
    renderShop();
    setMessage(`+$${amount} ${reason}`, "success");
  }

  function selectAircraft(id) {
    if (!state.aircraft.some((plane) => plane.id === id)) return;
    state.selectedId = id;
    renderUI();
  }

  function resetShift() {
    state.runways = Object.fromEntries(RUNWAYS.map((runway) => [runway.id, { cooldownUntil: 0 }]));
    state.runwaySelectionCursor = 0;
    state.emission = 0;
    state.emissionPenalized = false;
    state.emissionDraining = false;
    state.ambient = [];
    for (let i = 0; i < AMBIENT_COUNT; i += 1) state.ambient.push(spawnAmbient(true));
    state.aircraft = [
      createDeparture(SHIFT_DEPARTURES[0]),
      createDeparture(SHIFT_DEPARTURES[1]),
      createDeparture(SHIFT_DEPARTURES[2]),
      createArrival(SHIFT_ARRIVALS[0]),
      createDeparture(SHIFT_DEPARTURES[3]),
      createDeparture(SHIFT_DEPARTURES[4])
    ];
    state.completedFlights = [];
    state.returning = [];
    workerReadyAt = 0;
    state.selectedRunway = null;
    [3].forEach((index) => {
      const inbound = state.aircraft[index];
      inbound.stage = "approach";
      inbound.cleared = true;
      inbound.heading = bearing(inbound, currentTarget(inbound));
    });
    state.selectedId = state.aircraft[0]?.id ?? null;
    state.simTime = 0;
    state.airportTime = 0;
    state.realTime = 0;
    state.lastFrame = 0;
    state.lastUiUpdate = 0;
    state.paused = false;
    state.finished = false;
    state.gameOver = null;
    state.resolvedPairs = new Set();
    state.activeConflictKeys = new Set();
    state.emergencyKeys = new Set();
    state.won = false;
    state.departures = 0;
    state.arrivals = 0;
    state.emergencyAttempts = 0;
    state.emergencyActionsResolved = 0;
    state.score = 0;
    state.scoreTimeRemainder = 0;
    state.safeDepartures = 0;
    state.safeArrivals = 0;
    state.emergenciesResolved = 0;
    state.emergenciesFailed = 0;
    state.wrongResponses = 0;
    $("strike-toast").hidden = true;
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
    state.runwaySelectionCursor = 0;
    state.nextTrafficAt = 12;
    state.reportOpen = false;
    state.weather = { condition: "CLEAR", direction: 270, speed: 0, visibility: 10, warning: "No active weather advisories." };
    state.weatherEmergency = null;
    state.pendingEmergency = null;
    if (cutsceneTimer !== null) {
      window.clearTimeout(cutsceneTimer);
      cutsceneTimer = null;
    }
    $("failure-cutscene").hidden = true;
    state.paused = false;
    $("emergency-alert").hidden = true;
    $("emergency-command").disabled = false;
    $("emergency-submit").disabled = false;
    $("emergency-feedback").textContent = "";
    $("emergency-clock").textContent = "10s";
    $("mistake-count").textContent = `0 / ${MAX_WRONG_RESPONSES}`;
    state.lastCommand = "";
    state.commandConflictSnapshot = new Set();
    state.conflicts = [];
    analyzeConflicts();
    state.shiftStartDistance = metrics().distanceNm;
    updateWeather();
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
    setMessage("Select a waiting aircraft, pick an open runway, then press TAKE OFF.");
    renderUI();
    drawWorldMap();
  }

  const EMISSION_TIPS = [
    "Balance how many aircraft you release in a short period to keep emissions steady.",
    "Don't send too many planes out together!"
  ];
  function emissionLevel() {
    const airborne = state.aircraft.filter((plane) => ["takeoff", "airborne", "approach"].includes(plane.stage)).length;
    return Math.min(100, state.emissionDraining ? state.emission : state.emission + airborne * 2);
  }

  function checkEmissionPenalty() {
    const level = emissionLevel();
    if (level >= 100 && !state.emissionPenalized) {
      state.emissionPenalized = true;
      state.emissionDraining = true;
      state.emission = 100;
      state.score = Math.max(0, state.score - 100);
      $("shift-score").textContent = String(state.score);
      showStrike("Too much CO₂ emission! −100 points.", "CO₂ PENALTY");
    } else if (state.emissionDraining && state.emission <= 0) {
      state.emissionDraining = false;
      state.emissionPenalized = false;
    }
  }

  function renderEmissionMeter() {
    const level = Math.round(emissionLevel());
    $("co2-fill").style.height = `${100 - level}%`;
    $("co2-value").textContent = `${level}%`;
    const high = level >= 100;
    $("co2-meter").classList.toggle("max", high);
    $("co2-status").textContent = high ? "TOO MUCH CO₂ EMISSION!!!" : level >= 70 ? "HIGH" : level >= 40 ? "MODERATE" : "LOW";
    $("co2-tip").textContent = EMISSION_TIPS[Math.floor(Date.now() / 6000) % EMISSION_TIPS.length];
  }

  const AMBIENT_COUNT = 4;
  let ambientSerial = 0;
  let ambientMarkers = new Map();

  function spawnAmbient(inside = false) {
    const edge = Math.floor(Math.random() * 4);
    const along = (Math.random() - 0.5) * 18;
    const starts = [{ x: along, y: 13 }, { x: along, y: -13 }, { x: 14, y: along }, { x: -14, y: along }];
    let start = starts[edge];
    const goal = { x: -start.x * 0.9 + (Math.random() - 0.5) * 8, y: -start.y * 0.9 + (Math.random() - 0.5) * 8 };
    if (inside) start = { x: start.x * 0.85, y: start.y * 0.85 };
    ambientSerial += 1;
    return { id: `OV${100 + (ambientSerial * 37) % 900}`, x: start.x, y: start.y, heading: bearing(start, goal), speed: 430 + Math.random() * 60 };
  }

  function updateAmbient(dt) {
    while (state.ambient.length < AMBIENT_COUNT) state.ambient.push(spawnAmbient());
    const hazard = state.weather.hazard;
    for (const plane of state.ambient) {
      if (hazard) {
        const ahead = { x: plane.x + Math.sin(plane.heading * Math.PI / 180) * 3, y: plane.y + Math.cos(plane.heading * Math.PI / 180) * 3 };
        if (distance(ahead, hazard) < hazard.radius + 2.5 || distance(plane, hazard) < hazard.radius + 2.5) {
          const away = bearing(hazard, plane);
          const diff = ((away - plane.heading + 540) % 360) - 180;
          plane.heading = (plane.heading + Math.sign(diff || 1) * Math.min(Math.abs(diff), 140 * dt) + 360) % 360;
        }
      }
      const radians = plane.heading * Math.PI / 180;
      const step = SPEED_BOOST * plane.speed * dt / 3600;
      plane.x += Math.sin(radians) * step;
      plane.y += Math.cos(radians) * step;
    }
    state.ambient = state.ambient.filter((plane) => Math.abs(plane.x) < 17 && Math.abs(plane.y) < 15);
  }

  function updateMovement(simulatedSeconds) {
    const steps = Math.max(1, Math.ceil(simulatedSeconds / 0.1));
    const dt = simulatedSeconds / steps;
    for (let step = 0; step < steps; step += 1) {
      state.simTime += dt;
      updateWeather();
      updateAmbient(dt);
      // Once maxed out, the meter drains 10% per second until it reaches 0.
      state.emission = Math.max(0, state.emission - (state.emissionDraining ? 10 : 0.5) * dt);
      checkEmissionPenalty();
      for (const plane of state.aircraft) {
        if (["gate", "holding"].includes(plane.stage)) {
          plane.delaySeconds += dt;
          state.delaySeconds += dt;
          if (plane.gateDeadline !== undefined && (state.weather.condition === "THUNDERSTORM" || state.weather.visibility < 2)) plane.gateDeadline += dt;
          continue;
        }
        if (plane.stage === "takeoff") {
          plane.takeoffElapsed += dt;
          const progress = Math.min(1, plane.takeoffElapsed / TAKEOFF_DURATION_SECONDS);
          const runway = runwayDefinition(plane.runwayId);
          const distanceNm = SPEED_BOOST * plane.speed * Math.min(plane.takeoffElapsed, TAKEOFF_DURATION_SECONDS) / 3600;
          const radians = runway.heading * Math.PI / 180;
          plane.x = plane.takeoffOrigin.x + Math.sin(radians) * distanceNm;
          plane.y = plane.takeoffOrigin.y + Math.cos(radians) * distanceNm;
          if (progress >= 1) {
            plane.stage = "airborne";
            plane.altitude = 600;
            plane.targetAltitude = plane.cruiseAltitude;
            plane.heading = bearing(plane, currentTarget(plane) || plane);
            plane.departed = true;
            state.runways[runway.id].cooldownUntil = state.simTime + RUNWAY_COOLDOWN_SECONDS;
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
        if (!plane.departure && target?.name === `RUNWAY ${plane.runwayId}` && runwayPathBusy(plane)) {
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
              plane.x = runwayPoint(plane.runwayId).x;
              plane.y = runwayPoint(plane.runwayId).y;
            } else {
              plane.arrived = true;
              plane.cleared = false;
              plane.stage = "arrived";
            }
          }
        }
      }
      scheduleTraffic();
      if (state.departures + state.arrivals >= SHIFT_GOAL_PLANES) {
        state.won = true;
        endShift(null, `Shift complete! You safely handled ${SHIFT_GOAL_PLANES} planes with ${state.wrongResponses} error(s) and a CO₂ level of ${Math.round(emissionLevel())}%.`);
        return;
      }
      const collision = detectCollision();
      if (collision) {
        explodeAircraft([collision.first, collision.second]);
        state.aircraft = state.aircraft.filter((p) => p !== collision.first && p !== collision.second);
        state.wrongResponses += 1;
        if (state.wrongResponses >= MAX_WRONG_RESPONSES) {
          endShift(collision);
          return;
        }
        state.aircraftLost += 2;
        state.collisions += 1;
        showStrike(`You didn't assess the situation. ${collision.first.id} and ${collision.second.id} collided.`);
        continue;
      }
      if (state.finished) return;
    }
  }

  function handleGateTimers() {
    workerTick();
    for (const plane of [...state.aircraft]) {
      if (plane.departure && plane.stage === "gate") {
        plane.gateDeadline ??= state.simTime + GATE_TIMEOUT_SECONDS;
        if (state.simTime >= plane.gateDeadline) {
          state.aircraft = state.aircraft.filter((other) => other !== plane);
          state.score = Math.max(0, state.score - CANCEL_PENALTY);
          $("shift-score").textContent = String(state.score);
          if (state.selectedId === plane.id) state.selectedId = nextWaitingId();
          setMessage(`${plane.id} was cancelled after waiting ${GATE_TIMEOUT_SECONDS / 60} minutes. -${CANCEL_PENALTY} points.`, "error");
        }
      }
    }
    const due = state.returning.filter((item) => item.at <= state.simTime);
    if (due.length && state.aircraft.length < MAX_LOCAL_AIRCRAFT) {
      const item = due[0];
      state.returning = state.returning.filter((other) => other !== item);
      state.aircraft.push(createDeparture(item.template));
      setMessage(`${item.template.id} is back at the airport, ready for departure.`, "warning");
    }
  }

  function scheduleTraffic() {
    archiveCompletedFlights();
    handleGateTimers();
    if ((state.simTime < state.nextTrafficAt && state.aircraft.length >= MIN_LOCAL_AIRCRAFT) || state.aircraft.length >= MAX_LOCAL_AIRCRAFT ||
        state.pendingEmergency || state.weatherEmergency || state.conflicts.length) return;
    const slot = state.scheduledIndex++;
    const generated = slot % 2 === 0
      ? createArrival(SHIFT_ARRIVALS[(slot / 2 + 1) % SHIFT_ARRIVALS.length])
      : createDeparture(SHIFT_DEPARTURES[((slot - 1) / 2 + 5) % SHIFT_DEPARTURES.length]);
    generated.id = `${generated.departure ? "AC" : "IN"}${String(700 + slot).padStart(3, "0")}`;
    if (generated.template) generated.template = { ...generated.template, id: generated.id };
    state.aircraft.push(generated);
    state.nextTrafficAt = state.simTime + 8;
    setMessage(`${generated.id} entered Toronto airspace from ${generated.origin}; traffic count is now ${state.aircraft.length}.`, "warning");
    analyzeConflicts();
    renderUI();
    drawWorldMap();
  }

  function archiveCompletedFlights() {
    const completed = state.aircraft.filter((plane) => plane.arrived || plane.stage === "parked");
    if (!completed.length) return;
    completed.filter((plane) => plane.departure && plane.template).forEach((plane) => {
      state.returning.push({ template: plane.template, at: state.simTime + RETURN_DELAY_SECONDS });
    });
    state.completedFlights.push(...completed.map((plane) => ({ ...plane, route: [...plane.route] })));
    state.aircraft = state.aircraft.filter((plane) => !plane.arrived && plane.stage !== "parked");
    if (!state.aircraft.some((plane) => plane.id === state.selectedId)) state.selectedId = nextWaitingId();
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
            return `${result.message} Runway demand: ${pair.first.id} / ${pair.second.id} are competing for runway ${pair.first.runwayId}.`;
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
        return `${result.message} Potential conflict remains: ${closest.first.id} / ${closest.second.id}, would meet in ${Math.round(closest.seconds)}s.`;
      }
      return `${result.message} The traffic state changed; review the active alerts.`;
    }
    renderUI();
    drawWorldMap();
  }

  function parseCommand(raw) {
    const input = raw.trim().toUpperCase().replace(/\s+/g, " ").replace(/^DEROUTE(?=\s)/, "REROUTE");
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
      if (plane.arrived || !currentTarget(plane)) return { ok: false, message: `${plane.id} has no remaining route to clear.` };
      if (plane.stage !== "gate" || !plane.departure) return { ok: false, message: `${plane.id} is not waiting at a departure gate.` };
      return { ok: true, controlChange: true, message: authorizeDeparture(plane) };
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
        return { ok: false, message: "Choose Oakville, Toronto Island, Vaughan, Markham, or Brampton." };
      }
      const previousDistance = remainingRouteNm(plane);
      const waypoint = plane.route[0];
      const cityName = destinationKey;
      plane.destinationName = destination.region;
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
      if (plane.arrived || ["gate", "holding", "landing", "parked"].includes(plane.stage)) return { ok: false, message: `${plane.id} cannot accept a heading hold in its current stage.` };
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
    if (plane?.departure && plane.stage === "gate" &&
        !RUNWAYS.some((runway) => runwayAvailable(plane, runway.id))) {
      return "All runways are occupied or cooling down";
    }
    return "";
  }

  function arrivalPathBusy(plane) {
    return runwayPathBusy(plane);
  }

  function runwayPathBusy(plane, runwayId = plane.runwayId) {
    const point = runwayPoint(runwayId);
    return state.aircraft.some((other) =>
      other !== plane && other.runwayId === runwayId &&
      (RUNWAY_USE_STAGES.has(other.stage) ||
        (other.stage === "approach" && distance(other, point) <= 4))
    );
  }

  function runwayAvailable(plane, runwayId = plane.runwayId) {
    return Boolean(runwayId && state.runways[runwayId] &&
      state.runways[runwayId].cooldownUntil <= state.simTime &&
      !runwayPathBusy(plane, runwayId));
  }

  function chooseRunway(plane) {
    const ranked = RUNWAYS.map((runway, index) => {
      const cooldown = Math.max(0, state.runways[runway.id].cooldownUntil - state.simTime);
      const occupant = state.aircraft.find((other) => other !== plane &&
        other.runwayId === runway.id &&
        (RUNWAY_USE_STAGES.has(other.stage) ||
          (other.stage === "approach" && distance(other, runway.point) <= 4)));
      const available = cooldown === 0 && !occupant;
      return {
        runway,
        index,
        available,
        wait: Math.max(cooldown, occupant ? RUNWAY_OCCUPANCY_SECONDS : 0),
        rotation: (index - state.runwaySelectionCursor + RUNWAYS.length) % RUNWAYS.length
      };
    }).sort((first, second) =>
      Number(second.available) - Number(first.available) ||
      (first.available ? first.rotation - second.rotation : first.wait - second.wait || first.rotation - second.rotation)
    );
    const selected = ranked[0].runway;
    state.runwaySelectionCursor = (ranked[0].index + 1) % RUNWAYS.length;
    return selected;
  }

  function authorizeDeparture(plane) {
    const runway = RUNWAYS.find((item) => item.id === state.selectedRunway) || chooseRunway(plane);
    if (!runwayAvailable(plane, runway.id)) {
      return `${plane.id} remains at the airport; all runways are occupied or cooling down.`;
    }
    state.selectedRunway = null;
    plane.runwayId = runway.id;
    plane.cleared = true;
    plane.stage = "takeoff";
    plane.takeoffElapsed = 0;
    plane.takeoffOrigin = { ...runwayPoint(runway.id) };
    plane.x = plane.takeoffOrigin.x;
    plane.y = plane.takeoffOrigin.y;
    plane.heading = runway.heading;
    state.emission = Math.min(100, state.emission + 30);
    // A new departure interrupts the fast drain; the meter climbs again until it maxes out.
    state.emissionDraining = false;
    state.emissionPenalized = false;
    shop.money += 5;
    saveShop();
    renderShop();
    state.selectedId = nextWaitingId();
    return `+$5 · ${plane.id} taking off from runway ${runway.id}; destination ${plane.destinationName}.`;
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

  function renderUI() {
    $("sim-clock").textContent = formatClock(state.simTime);
    $("aircraft-count").textContent = `${state.aircraft.length} / ${MAX_LOCAL_AIRCRAFT}`;
    $("goal-count").textContent = `${Math.min(SHIFT_GOAL_PLANES, state.departures + state.arrivals)}/${SHIFT_GOAL_PLANES}`;
    $("shift-score").textContent = String(state.score);
    $("pause-button").textContent = state.paused ? "Resume" : "Pause";
    $("pause-button").disabled = state.finished || Boolean(state.weatherEmergency);
    $("pause-button").setAttribute("aria-pressed", String(state.paused));
    const totals = metrics();
    renderEmissionMeter();
    $("total-fuel").textContent = `${Math.round(totals.fuelKg).toLocaleString()} kg`;
    $("total-co2").textContent = `${Math.round(totals.co2Kg).toLocaleString()} kg`;
    renderTraffic();
    renderSelected();
    renderAircraftActions();
    renderSafety();
    renderWeather();
    renderRunwayStatus();
    renderRunwayButtons();
  }

  function runwayState(runway) {
    const occupant = state.aircraft.find((plane) => plane.runwayId === runway.id &&
      (RUNWAY_USE_STAGES.has(plane.stage) ||
        (plane.stage === "approach" && distance(plane, runway.point) <= 4)));
    if (occupant) return { label: "OCCUPIED", kind: "occupied" };
    const remaining = Math.ceil(Math.max(0, state.runways[runway.id].cooldownUntil - state.simTime));
    if (remaining > 0) return { label: `COOLDOWN ${remaining}s`, kind: "cooldown" };
    return { label: "OPEN", kind: "open" };
  }

  function renderRunwayButtons() {
    const holder = $("runway-buttons");
    const text = RUNWAYS.map((runway) => `${runway.id}:${runwayState(runway).label}:${state.selectedRunway === runway.id}`).join("|");
    if (holder.dataset.renderKey === text) return;
    holder.dataset.renderKey = text;
    holder.replaceChildren(...RUNWAYS.map((runway) => {
      const status = runwayState(runway);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `runway-button ${status.kind}${state.selectedRunway === runway.id ? " selected" : ""}`;
      button.innerHTML = `<strong>RWY ${runway.id}</strong><span>${status.label}</span>`;
      button.disabled = status.kind !== "open" || state.finished;
      button.setAttribute("aria-pressed", String(state.selectedRunway === runway.id));
      button.addEventListener("click", () => {
        state.selectedRunway = state.selectedRunway === runway.id ? null : runway.id;
        renderUI();
      });
      return button;
    }));
  }

  function renderRunwayStatus() {
    const holder = $("runway-status");
    holder.replaceChildren(...RUNWAYS.map((runway) => {
      const status = runwayState(runway);
      const item = document.createElement("span");
      item.className = `runway-status-item ${status.kind}`;
      item.textContent = `${runway.id} ${status.label}`;
      return item;
    }));
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
      meta.textContent = plane.destinationName;
      info.append(call, meta);
      const status = document.createElement("span");
      const hasAlert = state.conflicts.some((pair) => pair.first === plane || pair.second === plane);
      status.className = hasAlert ? "traffic-alert" : `traffic-track ${plane.departure && plane.stage === "gate" ? "is-ready" : "is-air"}`;
      row.classList.add(plane.departure && plane.stage === "gate" ? "row-ready" : "row-air");
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
    const name = document.createElement("strong");
    name.textContent = `${plane.id} · ${stageLabel(plane)}`;
    const detail = document.createElement("p");
    detail.textContent = `${plane.origin} → ${plane.destinationName} · ${Math.round(plane.altitude).toLocaleString()} ft · ${Math.round(plane.speed)} kt · HDG ${String(Math.round(plane.heading) % 360).padStart(3, "0")}`;
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

  function renderAircraftActions() {
    const holder = $("aircraft-actions");
    const plane = getPlane(state.selectedId);
    const reason = plane?.stage === "gate" || plane?.stage === "holding"
      ? departureBlockReason(plane)
      : "";
    const chosen = RUNWAYS.find((item) => item.id === state.selectedRunway);
    const runwayKind = chosen ? runwayState(chosen).kind : "none";
    const key = `${state.selectedRunway}:${runwayKind}:${plane?.id || "none"}:${plane?.stage || "none"}:${plane?.routeIndex ?? ""}:${plane?.route.length ?? ""}:${reason}:${state.departuresPaused}:${state.paused}:${state.finished}`;
    if (holder.dataset.renderKey === key) return;
    holder.dataset.renderKey = key;
    holder.replaceChildren();
    if (!plane) {
      const empty = document.createElement("p");
      empty.className = "empty-actions";
      empty.textContent = "No active aircraft. New simulated traffic will enter when a slot is available.";
      holder.append(empty);
      return;
    }
    let action = null;
    if (plane.stage === "gate") {
      const reason = departureBlockReason(plane) ||
        (!chosen ? "Select an open runway first" : runwayKind !== "open" ? `Runway ${chosen.id} is not open` : "");
      action = { label: chosen ? `TAKE OFF · RWY ${chosen.id}` : "TAKE OFF", command: `DEPART ${plane.id}`, reason, primary: true };
    } else if (plane.stage === "holding") {
      const reason = departureBlockReason(plane);
      action = { label: "CLEAR TO LAND", command: `ARRIVAL ${plane.id}`, reason, primary: true };
    }
    if (action) {
      addActionButton(holder, action.label, action.command, {
        primary: action.primary,
        disabled: Boolean(action.reason),
        title: action.reason || action.label
      });
      if (action.reason) {
        const note = document.createElement("span");
        note.className = "action-note blocked";
        note.textContent = action.reason;
        holder.append(note);
      }
    } else if (plane.stage === "takeoff") {
      const note = document.createElement("span");
      note.className = "action-note";
      note.textContent = `RUNWAY ${plane.runwayId} · DEPARTING`;
      holder.append(note);
    }
  }

  function stageLabel(plane) {
    return plane.departure && plane.stage === "gate" ? "READY" : "IN THE AIR";
  }

  function renderWeather() {
    const windowEl = document.querySelector(".tower-window");
    const condition = state.weather.condition;
    windowEl.classList.toggle("wx-rain", condition === "RAIN");
    windowEl.classList.toggle("wx-storm", condition === "THUNDERSTORM");
    $("weather-condition").textContent = state.weather.condition;
    const risks = state.aircraft.filter(aircraftWeatherRisk).map((plane) => plane.id);
    $("weather-warning").textContent = risks.length
      ? `WEATHER ROUTE RISK · ${risks.join(" / ")}`
      : state.weather.warning;
    $("emergency-alert").hidden = !state.weatherEmergency;
  }

  function renderSafety() {
    const banner = $("safety-banner");
    const text = $("safety-text");
    const risk = state.conflicts.length > 0 || state.aircraft.some(aircraftWeatherRisk) || Boolean(state.pendingEmergency);
    banner.hidden = !risk;
    banner.disabled = !state.pendingEmergency;
    banner.classList.toggle("alert", risk);
    banner.classList.remove("safe");
    if (state.conflicts.length) {
      const nearest = [...state.conflicts].sort((a, b) => a.seconds - b.seconds)[0];
      text.textContent = nearest.kind === "runway"
        ? `RUNWAY ${nearest.first.runwayId} · ${nearest.first.id} / ${nearest.second.id}`
        : `CONFLICT · ${nearest.first.id} / ${nearest.second.id} · IMPACT ~${Math.max(1, Math.round(nearest.seconds))}s`;
    } else if (state.aircraft.some(aircraftWeatherRisk)) {
      text.textContent = `WEATHER RISK · ${state.aircraft.filter(aircraftWeatherRisk).map((plane) => plane.id).join(" / ")}`;
    } else if (state.pendingEmergency) {
      text.textContent = `${state.pendingEmergency.type} · ${state.pendingEmergency.targetIds.join(" / ")}`;
    }
    banner.querySelector(".warning-action").textContent = state.pendingEmergency ? `RESPOND ${Math.max(0, Math.ceil(((state.pendingEmergency.expires ?? performance.now() + (state.pendingEmergency.reactionMs ?? EMERGENCY_RESPONSE_MS)) - performance.now()) / 1000))}s` : "MONITOR";
  }

  function initializeCityMap() {
    if (!window.L) {
      mapLoadStatus.textContent = "The city map could not load. Check your internet connection and reload.";
      mapLoadStatus.hidden = false;
      setMessage("The city map library failed to load.", "error");
      return;
    }
    cityMap = window.L.map(cityMapElement, {
      zoomControl: false,
      zoomSnap: 0,
      zoomDelta: 0,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false,
      zoomAnimation: false,
      markerZoomAnimation: false,
      fadeAnimation: false
    }).fitBounds(RADAR_BOUNDS, { padding: [4, 4], animate: false });
    window.L.marker([AIRPORT_GEO.lat, AIRPORT_GEO.lon], {
      icon: window.L.divIcon({
        className: "airport-map-marker",
        html: "<span>YYZ</span>",
        iconSize: [42, 20],
        iconAnchor: [21, 10]
      }),
      keyboard: false,
      interactive: false,
      zIndexOffset: 300
    }).addTo(cityMap);
    weatherLayer = window.L.circle([AIRPORT_GEO.lat, AIRPORT_GEO.lon], {
      radius: 1,
      color: "#ba8068",
      weight: 1,
      dashArray: "5 5",
      fillColor: "#ba8068",
      fillOpacity: 0.08,
      interactive: false
    }).addTo(cityMap);
    cityMap.on("tileerror", () => {
      mapLoadStatus.textContent = "Some city map tiles could not load. Check your connection; flight tracking remains available.";
      mapLoadStatus.hidden = false;
    });
    cityMap.on("tileload", () => {
      mapLoadStatus.hidden = true;
    });
    cityMap.whenReady(() => {
      cityMap.invalidateSize();
      cityMap.fitBounds(RADAR_BOUNDS, { padding: [4, 4], animate: false });
      drawWorldMap();
    });
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

      drawRunways(ctx, width, height, airportLighting);
      drawTerminal(ctx, width, height, airportLighting);
      drawHangar(ctx, width * 0.08, horizon * 0.80, width * 0.12, height * 0.12, airportLighting);
      drawHangar(ctx, width * 0.83, horizon * 0.80, width * 0.105, height * 0.095, airportLighting);
      drawRunways(ctx, width, height, airportLighting, true);
      drawWindsock(ctx, width * 0.19, horizon * 1.04, height * 0.12, airportLighting, timestamp);
      drawWeatherOutside(ctx, width, height, timestamp);
      drawDepartingAircraft(ctx, width, height);
    }

    function drawDepartingAircraft(ctx, width, height) {
      for (const plane of state.aircraft) {
        if (!plane.departure || plane.stage !== "takeoff") continue;
        const progress = Math.min(1, plane.takeoffElapsed / TAKEOFF_DURATION_SECONDS);
        let scale = Math.max(1, width / 900);
        const runway = runwayDefinition(plane.runwayId);
        const start = runway.screenNear;
        const end = runway.screenFar;
        const heading = Math.atan2(end.x - start.x, start.y - end.y);
        scale *= 1 - progress * 0.35;
        const x = start.x + (end.x - start.x) * progress;
        const y = start.y + (end.y - start.y) * progress;
        const centerX = x * width;
        const centerY = y * height;
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(heading);
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
      const y = horizon * 0.68;
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

    function drawRunways(ctx, width, height, mode, labelsOnly = false) {
      for (const runway of [RUNWAYS[0], RUNWAYS[2], RUNWAYS[1]]) {
        const near = { x: runway.screenNear.x * width, y: runway.screenNear.y * height };
        const far = { x: runway.screenFar.x * width, y: runway.screenFar.y * height };
        const dx = far.x - near.x;
        const dy = far.y - near.y;
        const length = Math.hypot(dx, dy);
        const normal = { x: -dy / length, y: dx / length };
        const nearHalf = width * (runway.id === "18" ? 0.055 : 0.045);
        const farHalf = width * 0.008;
        const edgePoint = (point, half, side) => ({
          x: point.x + normal.x * half * side,
          y: point.y + normal.y * half * side
        });
        if (!labelsOnly) {
          ctx.fillStyle = mode === "night" ? "#252d32" : "#4a5458";
          ctx.beginPath();
          const farLeft = edgePoint(far, farHalf, -1);
          const farRight = edgePoint(far, farHalf, 1);
          const nearRight = edgePoint(near, nearHalf, 1);
          const nearLeft = edgePoint(near, nearHalf, -1);
          ctx.moveTo(farLeft.x, farLeft.y);
          ctx.lineTo(farRight.x, farRight.y);
          ctx.lineTo(nearRight.x, nearRight.y);
          ctx.lineTo(nearLeft.x, nearLeft.y);
          ctx.closePath();
          ctx.fill();
        }
        const label = `RUNWAY ${runway.id}`;
        const labelX = (far.x + near.x) / 2;
        const labelY = Math.min(height - 6, near.y - height * 0.025);
        ctx.fillStyle = mode === "night" ? "#f0f1e5" : "#ecebdd";
        ctx.font = `700 ${Math.max(9, Math.min(12, width * 0.008))}px monospace`;
        ctx.textAlign = "center";
        const textWidth = ctx.measureText(label).width;
        ctx.fillStyle = "rgba(18, 27, 31, .72)";
        ctx.fillRect(labelX - textWidth / 2 - 4, labelY - 12, textWidth + 8, 16);
        ctx.fillStyle = mode === "night" ? "#f0f1e5" : "#ecebdd";
        ctx.fillText(label, labelX, labelY);
      }
      ctx.textAlign = "start";
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

  function drawWorldMap() {
    if (!cityMap) return;
    const liveIds = new Set(state.aircraft.map((plane) => plane.id));
    for (const [id, marker] of aircraftMarkers) {
      if (liveIds.has(id)) continue;
      cityMap.removeLayer(marker);
      aircraftMarkers.delete(id);
    }
    for (const plane of state.aircraft) {
      const gated = plane.departure && plane.stage === "gate";
      const gateList = state.aircraft.filter((other) => other.departure && other.stage === "gate");
      const angle = (gateList.indexOf(plane) / Math.max(gateList.length, 6)) * Math.PI * 2 + 0.4;
      const position = localNmToGeographic(gated
        ? { x: plane.x + Math.sin(angle) * 5.5, y: plane.y + Math.cos(angle) * 5.5 }
        : plane);
      const nearby = state.aircraft.filter((other) => distance(plane, other) < 3);
      const labelOffset = gated ? 0 : (nearby.indexOf(plane) - (nearby.length - 1) / 2) * 14;
      const conflict = state.conflicts.some((pair) => pair.first === plane || pair.second === plane);
      const selected = plane.id === state.selectedId;
      const icon = window.L.divIcon({
        className: "aircraft-map-icon",
        html: `<span class="aircraft-map-tag${selected ? " selected" : ""}${conflict ? " conflict" : ""}"><i style="--heading:${plane.heading}deg"></i><b style="--label-offset:${labelOffset}px">${plane.id}</b></span>`,
        iconSize: [104, 24],
        iconAnchor: [12, 12]
      });
      let marker = aircraftMarkers.get(plane.id);
      if (!marker) {
        marker = window.L.marker([position.lat, position.lon], {
          icon,
          keyboard: true,
          title: `${plane.id} · ${stageLabel(plane)}`
        }).addTo(cityMap);
        marker.on("click", () => selectAircraft(plane.id));
        aircraftMarkers.set(plane.id, marker);
        marker.iconHtml = icon.options.html;
      } else {
        marker.setLatLng([position.lat, position.lon]);
        if (marker.iconHtml !== icon.options.html) {
          marker.setIcon(icon);
          marker.iconHtml = icon.options.html;
        }
        marker.setZIndexOffset(selected ? 500 : 0);
        marker.options.title = `${plane.id} · ${stageLabel(plane)}`;
      }
    }
    drawAmbient();
    updateWeatherLayer();
    updateConflictLayers();
  }

  function drawAmbient() {
    const live = new Set(state.ambient.map((plane) => plane.id));
    for (const [id, marker] of ambientMarkers) {
      if (live.has(id)) continue;
      cityMap.removeLayer(marker);
      ambientMarkers.delete(id);
    }
    for (const plane of state.ambient) {
      const position = localNmToGeographic(plane);
      let marker = ambientMarkers.get(plane.id);
      if (!marker) {
        marker = window.L.marker([position.lat, position.lon], {
          icon: window.L.divIcon({
            className: "aircraft-map-icon ambient-icon",
            html: `<span class="aircraft-map-tag ambient"><i style="--heading:${plane.heading}deg"></i><b>${plane.id}</b></span>`,
            iconSize: [104, 24], iconAnchor: [12, 12]
          }),
          interactive: false, keyboard: false
        }).addTo(cityMap);
        ambientMarkers.set(plane.id, marker);
      } else {
        marker.setLatLng([position.lat, position.lon]);
        const icon = marker.getElement()?.querySelector("i");
        if (icon) icon.style.setProperty("--heading", `${plane.heading}deg`);
      }
    }
  }

  function updateRouteLayers() {
    for (const [id, layer] of routeLayers) {
      cityMap.removeLayer(layer);
      routeLayers.delete(id);
    }
  }

  function updateWeatherLayer() {
    const hazard = state.weather.hazard;
    if (!hazard) {
      if (cityMap.hasLayer(weatherLayer)) cityMap.removeLayer(weatherLayer);
      return;
    }
    const position = localNmToGeographic(hazard);
    weatherLayer.setLatLng([position.lat, position.lon]);
    weatherLayer.setRadius(hazard.radius * 1852);
    if (!cityMap.hasLayer(weatherLayer)) weatherLayer.addTo(cityMap);
  }

  function updateConflictLayers() {
    const active = new Set();
    const colors = ["#e0a95a", "#8fc7dd"];
    for (const pair of state.conflicts) {
      const key = `${pair.kind}:${pairKey(pair.first, pair.second)}`;
      active.add(key);
      const [a, b] = [pair.first, pair.second].map((plane) => {
        const point = localNmToGeographic(plane);
        return [point.lat, point.lon];
      });
      let layer = conflictLayers.get(key);
      if (!layer) {
        layer = {
          rings: colors.map((color, index) => window.L.circleMarker([a[0], a[1]], {
            radius: 17, color: colors[index], weight: 2, fillOpacity: 0, interactive: false, className: "conflict-ring"
          }).addTo(cityMap)),
          link: window.L.polyline([a, b], { color: "#e0a95a", weight: 2, opacity: 0.9, interactive: false, className: "conflict-link" }).addTo(cityMap)
        };
        conflictLayers.set(key, layer);
      }
      layer.rings[0].setLatLng(a);
      layer.rings[1].setLatLng(b);
      layer.link.setLatLngs([a, b]);
    }
    for (const [key, layer] of conflictLayers) {
      if (active.has(key)) continue;
      layer.rings.forEach((ring) => cityMap.removeLayer(ring));
      cityMap.removeLayer(layer.link);
      conflictLayers.delete(key);
    }
  }

  function shiftGrade() {
    if (state.wrongResponses >= MAX_WRONG_RESPONSES || state.collisions) return "F";
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
    if (collision) return "Review map routes and predicted separation before releasing or clearing aircraft.";
    if (state.wrongResponses) return "Read the warning, check the callsign, and enter a valid flight-control command before the timer expires.";
    if (state.safeDepartures < state.departures) return "Check runway demand, weather, and separation before authorizing each takeoff.";
    if (state.safeArrivals < state.arrivals) return "Give arriving aircraft clear runway spacing and monitor visibility.";
    if (!state.efficientRoutes) return "Compare route distance and estimated fuel, then use safe shortcuts when available.";
    return "Keep monitoring runway demand and predicted separation as traffic changes.";
  }

  function endShift(collision, reason = "") {
    if (state.finished) return;
    state.finished = true;
    state.paused = true;
    state.earned = Math.floor(state.score / 10);
    shop.money += state.earned;
    saveShop();
    renderShop();
    state.gameOver = collision;
    state.endReason = reason || (collision
      ? `Collision involving ${collision.first.id} and ${collision.second.id}.`
      : "The shift has ended.");
    if (collision) {
      state.collisions += 1;
      state.aircraftLost += 2;
    }
    state.weatherEmergency = null;
    state.pendingEmergency = null;
    $("strike-toast").hidden = true;
    $("emergency-alert").hidden = true;
    $("emergency-command").disabled = true;
    $("emergency-submit").disabled = true;
    if ($("results-dialog").open) $("results-dialog").close();
    if ($("rules-dialog").open) $("rules-dialog").close();
    state.reportOpen = false;
    const totals = metrics();
    const grade = shiftGrade();
    const duration = formatClock(state.simTime);
    $("results-kicker").textContent = state.won ? "SHIFT COMPLETE - YOU WIN" : "YOU FAILED";
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
      resultCell("Incorrect responses", `${state.wrongResponses} / ${MAX_WRONG_RESPONSES}`),
      resultCell("Collisions", String(state.collisions)),
      resultCell("Aircraft lost", String(state.aircraftLost)),
      resultCell("Money earned", `$${state.earned ?? 0}`),
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
    $("failure-cutscene").classList.toggle("win", Boolean(state.won));
    $("failure-cutscene-title").textContent = state.won ? "YOU WIN" : "YOU FAILED";
    $("failure-cutscene-message").textContent = state.won
      ? state.endReason
      : `What happened: ${state.endReason} Final score ${state.score}.`;
    $("failure-cutscene").hidden = false;
    cutsceneTimer = window.setTimeout(() => {
      cutsceneTimer = null;
      $("failure-cutscene").hidden = true;
      if (state.finished && !$("results-dialog").open) $("results-dialog").showModal();
    }, 3500);
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

  function emergencyActionSuccessRate() {
    if (!state.emergencyAttempts) return "No responses";
    const percentage = Math.round(state.emergencyActionsResolved / state.emergencyAttempts * 100);
    return `${state.emergencyActionsResolved}/${state.emergencyAttempts} (${percentage}%)`;
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
      resultCell("Incorrect responses", `${state.wrongResponses} / ${MAX_WRONG_RESPONSES}`),
      resultCell("Conflicts detected", String(state.conflictEvents)),
      resultCell("Alerts cleared", String(state.resolvedPairs.size)),
      resultCell("Emergency actions resolved", emergencyActionSuccessRate()),
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
    $("tutorial-title").textContent = "WELCOME TO AIR CONTROL";
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
      updateMovement(elapsed);
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
    drawWorldMap();
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
    resetShop();
    resetShift();
  });
  $("safety-banner").addEventListener("click", () => {
    if (state.pendingEmergency && !state.weatherEmergency) beginEmergency(state.pendingEmergency);
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
  $("shop-sign").addEventListener("click", () => { renderShop(); $("shop-dialog").showModal(); });
  $("open-learn").addEventListener("click", () => {
    $("learn-fuel").textContent = $("total-fuel").textContent;
    $("learn-co2").textContent = $("total-co2").textContent;
    $("learn-dialog").showModal();
  });
  $("learn-close").addEventListener("click", () => $("learn-dialog").close());
  $("shop-close").addEventListener("click", () => $("shop-dialog").close());
  $("shop-luxury-buy").addEventListener("click", buyLuxury);
  $("shop-workers-buy").addEventListener("click", buyWorkers);
  renderShop();
  $("shift-report").addEventListener("click", () => {
    if (state.weatherEmergency) return;
    openShiftReport();
  });
  $("emergency-command-form").addEventListener("submit", (event) => {
    event.preventDefault();
    submitTypedResponse();
  });
  $("emergency-alert").addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const controls = [...$("emergency-alert").querySelectorAll("button:not(:disabled), input:not(:disabled)")];
    if (!controls.length) return;
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  $("close-results").addEventListener("click", () => {
    $("results-dialog").close();
    state.reportOpen = false;
  });
  $("play-again").addEventListener("click", () => {
    if (state.reportOpen) {
      $("results-dialog").close();
      state.reportOpen = false;
    } else {
      resetShop();
      resetShift();
    }
  });
  window.addEventListener("resize", () => {
    if (cityMap) {
      cityMap.invalidateSize();
      const visibleBounds = cityMap.getBounds();
      if (!visibleBounds.contains(AIRSPACE_BOUNDS[0]) || !visibleBounds.contains(AIRSPACE_BOUNDS[1])) {
        cityMap.fitBounds(AIRSPACE_BOUNDS, { padding: [20, 20], animate: false });
      }
    }
    drawWorldMap();
    drawAirport();
  });

  initializeCityMap();
  resetShift();
  drawAirport();
  showFirstVisitTutorial();
  requestAnimationFrame(tick);
})();
