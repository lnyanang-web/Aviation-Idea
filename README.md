# Tower Control

Tower Control is a local, browser-based airport operations game. Manage fictional departures, arrivals, routes, and changing weather through a radar and flight-control monitor. Aircraft, weather, positions, and outcomes are simulated; this is an educational prototype, not an operational air traffic control tool.

## Run in VS Code

1. Open this folder in VS Code.
2. Open `index.html` and choose **Go Live** if you have the Live Server extension. The usual address is `http://localhost:5500`.
3. Or open `index.html` directly in a current browser. No packages, backend services, API keys, or network access are required.

## Play

- Each new browser session opens the welcome tutorial. Start the tutorial or skip straight to play; **Help** reopens it later, and **Rules** opens a short reference. It covers radar, aircraft limits, weather, emergencies, sustainability, and scoring.
- The game is a continuous shift, not a mission sequence. The local airport begins with four aircraft. Select an aircraft in the flight list or on the radar to inspect it.
- Use **AUTHORIZE TAKEOFF** to release a waiting departure. The radar's **AIRPORT** point marks where aircraft taxi to the runway. Only one departure taxis or uses the runway at a time; additional authorized departures wait in order and start taxiing once the current aircraft has taken off and the runway path is clear. Arrivals and changing weather also hold departures automatically when needed for spacing. Use the available buttons to manage arrivals, taxi holds, and airborne aircraft. Normal play does not require typing commands.
- Radar warnings show modeled airspace conflicts and competing runway demand. Aircraft continue moving while you assess ordinary warnings.
- A critical conflict or storm hazard pauses the simulation and opens one emergency at a time. Type the exact displayed `HOLD` or `REROUTE` command within 10 real-time seconds. Incorrect attempts do not reset the countdown; a timeout immediately ends the shift.
- Earn 10 points for each 10 seconds of active safe play, 100 for resolving a critical emergency, 25 for a safe departure or arrival, and 15 for a genuinely shorter safe route. Paused or unsafe time does not earn survival points.
- Traffic continues to arrive and depart. New aircraft enter only when one of the four local slots becomes available. Aircraft are drawn outside only while taxiing or taking off; cruising, approach, and arrival movement remain visible on the radar and flight list. A collision or emergency timeout ends the shift and opens the Current Shift Report with a grade, score, safety outcomes, estimated fuel and CO₂, and a suggestion. A timeout or collision always receives an F. Use **RESTART SHIFT** to start again.
- **Pause** stops and resumes a shift. The **Shift report** summarizes operations without pausing traffic. Use **View** to change the airport lighting to day, sunset, or night.

## Simulation and estimates

- The circular radar is the primary view of aircraft movement and shows the airport taxi point, routes, conflicts, and weather hazards without extra waypoint labels or navigation markers. The airport view shows the cartoon airport and weather; aircraft appear there only during taxi and takeoff.
- Conflict detection predicts constant-velocity closest approach over eight simulated minutes. A warning is shown when predicted horizontal distance is under **5 NM** and vertical difference is under **1,000 ft**. These are demonstration thresholds only, not real-world separation standards; this simplified model omits many operational factors.
- Route-distance, fuel, and CO₂ figures are illustrative estimates. Fuel is calculated as route distance × **8 kg/NM** and CO₂ as estimated fuel × **3.16 kg CO₂/kg fuel**. Real fuel use and emissions depend on aircraft, engines, payload, altitude, weather, operations, and fuel lifecycle.
- Safety takes priority over route efficiency and lower estimated emissions. This game is not operational guidance.

## Files

- `index.html` contains the two-monitor tower layout, score counter, flight controls, emergency response form, and reference dialogs.
- `style.css` styles the responsive tower and simulation interface.
- `script.js` contains aircraft movement, continuous traffic scheduling, conflict and weather checks, emergency handling, sustainability estimates, and canvas drawing.

The project uses plain HTML, CSS, JavaScript, and Canvas; it has no external libraries or services.
