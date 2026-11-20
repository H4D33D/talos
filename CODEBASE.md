# Codebase guide

A quick tour of how Talos is put together.

## The big picture

```
Zigbee sensor ──► server.py ──► /api/status ──► the page (static/)
Pi stats (/proc) ──┘
```

`server.py` collects the data and works out what it means. The page asks for it once a second and shows it.

## Files

| File | What it does |
|---|---|
| `server.py` | The server. Listens to the sensor, serves the page, and handles button presses. |
| `lock.py` | The passcode lock and settings. |
| `health.py` | Reads the Pi's CPU, RAM, disk and uptime. |
| `daylight.py` | Works out sunrise, sunset and day or night. |
| `app.py` | The window on the Pi's screen. Switches between the dashboard and Google Home. |
| `install.sh` | Sets Talos up on the Pi. |
| `display.py`, `input-activity.py`, `system-helper.py` | Small helpers: screen off, touch tracking, and restart or shut down. |
| `static/index.html` | The page layout. |
| `static/style.css` | How the page looks. |
| `static/app.js` | Updates the page and handles taps. |
| `static/nav.html` | The nav bar that sits over Google Home. |
| `static/demo.js` | Makes the live demo work in the browser with fake data. |
| `tests/` | Tests for the sensor rules, sun maths, Pi stats and lock. |

## Run it

```bash
python3 server.py --demo
```

Then open http://127.0.0.1:8090.