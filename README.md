# Talos

Talos is a personal home hub I'm developing for my Raspberry Pi 4. It features a custom, cyberpunk-inspired interface designed to monitor my home network, manage devices, and bring different functions together in one place.

The project is still in development, with more features and integrations planned, plans are being changed constantly.
![Talos Dashboard](images/dashboard.png)

I designed and programmed the interface using Python, HTML, CSS, and JavaScript. My goal was to create something functional while giving it a distinct visual style inspired by Cyberpunk 2077.
Having completed Phantom Liberty recently, I was inspired to make talos.

## What I used so far...
- Pi 4
- 7" Touch Screen Pi4 Case
- Network Switch
- Sonoff Gateway Adapter
- Aqara Precense Sensor

## What I've Built

- Custom dashboard and navigation
- System monitoring and network information
- Notifications and system controls
- Raspberry Pi integration
- Google Home access (Not embedded ;) )

## Pictures

### Main Dashboard
![Main Dashboard](images/dashboard.png)
One of my favorite designs I made was the Sensor Indicators and my lux bar. 
This feature was implemented so that I could work with headphones, knowing if someone need my attention from my office. 
I believe solid colored indictors are a very underrated and underutilized way to communicate information.

Indicator 1 (Left) - Displays the sensor's state of motion. 
| Indicator Color | Purpose | Display Name |
|---|---|---|
| Green | No updates in the last minute. | IDLE |
| Yellow | Motion within the past minute. | CAUTION |
| Red | Sensor is actively triggered. | THROTTLE |

Indicator 2 (Right) - Displays the sensor's radar field. 
| Indicator Color | Purpose | Display Name |
|---|---|---|
| Green | No updates in the last minute. | CLEAR |
| Red | Sensor is actively triggered. | BOTTLENECK |

Illumence Bar - Displays sensor's lux readings. 
|Illumance Bar | Color | Purpose |
|---|---|---|
| lux < 10 | Black | Hallway light is OFF. |
| lux > 10 | White | Hallway light is ON. |

The display name is supposed to evoke some mystery, since I want to be the only one who understands what the hub is communicating. 
That's why it reads like a network traffic issue, rather than sensors. 

### System Controls
![System Controls](images/system.png)

### Google Home
![System Controls](images/system.png)
The way I implemented Google Home wasn't thought to be embedded within my Python app; I can't do that. I simply have a Chromium window open without Chromium borders, set to a specific resolution and point. When I tap Google Home on the navigation bar, the Chromium window is brought to the front. 

### Other Features
![Other Features](images/features.png)

## What's Next

- [ ] Homelab Integration
- [ ] 
- [ ] 
- [ ] 
- [ ] 

## The Name

Talos takes its name from the bronze guardian of Greek mythology, known for protecting the island of Crete.

I chose the name because I wanted the system to serve as a guardian and monitoring hub for my home.

![Talos](images/talos.jpg)

---

**Status:** Ongoing personal project.
