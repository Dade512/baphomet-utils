/* ============================================================
   ECHOES OF BAPHOMET — WEATHER ENGINE v1.0
   Season-aware, climate-zone-based weather generation
   integrated with Simple Calendar.

   WHAT IT DOES:
   - Reads current date from Simple Calendar
   - Determines current season from Golarion calendar
   - Generates daily weather (temp, wind, precipitation, clouds)
     based on the active climate zone
   - GM can change climate zone via macro API or chat command
   - Stores current weather in module flags for persistence
   - Displays weather in a Croaker's Ledger styled panel
   - Posts daily weather to chat on day advance (optional)

   HOOKS:
   - simple-calendar-date-time-change: fires when SC date changes
   - ready: initialize weather state

   DEPENDENCIES:
   - Simple Calendar (foundryvtt-simple-calendar)
   - baphomet-utils climate-zones.js (loaded first via module.json)

   For Foundry VTT v13 + PF1e System
   ============================================================ */

const WE_MODULE_ID = 'baphomet-utils';

/* ----------------------------------------------------------
   GOLARION SEASON MAPPING
   Maps month index (0-11) to season name.
   Months: 0=Abadius, 1=Calistril, 2=Pharast, 3=Gozran,
           4=Desnus, 5=Sarenith, 6=Erastus, 7=Arodus,
           8=Rova, 9=Lamashan, 10=Neth, 11=Kuthona

   Seasons from Fantasy Calendar export:
   Spring: starts month 2 (Pharast)
   Summer: starts month 5 (Sarenith)
   Fall:   starts month 8 (Rova)
   Winter: starts month 11 (Kuthona)
   ---------------------------------------------------------- */

const GOLARION_MONTHS = [
  'Abadius', 'Calistril', 'Pharast', 'Gozran',
  'Desnus', 'Sarenith', 'Erastus', 'Arodus',
  'Rova', 'Lamashan', 'Neth', 'Kuthona'
];

const MONTH_TO_SEASON = {
  0: 'winter',    // Abadius
  1: 'winter',    // Calistril
  2: 'spring',    // Pharast
  3: 'spring',    // Gozran
  4: 'spring',    // Desnus
  5: 'summer',    // Sarenith
  6: 'summer',    // Erastus
  7: 'summer',    // Arodus
  8: 'fall',      // Rova
  9: 'fall',      // Lamashan
  10: 'fall',     // Neth
  11: 'winter',   // Kuthona
};

/* ----------------------------------------------------------
   SEEDED RANDOM NUMBER GENERATOR
   Deterministic based on year + day-of-year + seed.
   Same date always produces same weather (unless climate
   zone changes). Uses mulberry32 PRNG.
   ---------------------------------------------------------- */

function _mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function _getWeatherSeed(year, dayOfYear, climateName) {
  // Combine date + climate name into a deterministic seed
  let hash = 0;
  const str = `${year}-${dayOfYear}-${climateName}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

/* ----------------------------------------------------------
   WEATHER GENERATION
   ---------------------------------------------------------- */

function generateWeather(year, monthIndex, day, climateKey) {
  const climate = GOLARION_CLIMATES[climateKey];
  if (!climate) {
    console.warn(`${WE_MODULE_ID} | Weather: Unknown climate zone "${climateKey}"`);
    return null;
  }

  const season = MONTH_TO_SEASON[monthIndex];
  if (!season) {
    console.warn(`${WE_MODULE_ID} | Weather: Unknown month index ${monthIndex}`);
    return null;
  }

  const params = climate.seasons[season];
  const monthName = GOLARION_MONTHS[monthIndex] ?? 'Unknown';

  // Calculate day of year for seed
  const monthLengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let dayOfYear = day;
  for (let i = 0; i < monthIndex; i++) {
    dayOfYear += monthLengths[i];
  }

  // Seeded RNG for this specific day
  const seed = _getWeatherSeed(year, dayOfYear, climateKey);
  const rng = _mulberry32(seed);

  // --- Temperature ---
  const tempVariance = (rng() * 2 - 1) * params.variance;
  const highTemp = Math.round(params.base + tempVariance);
  const lowTemp = Math.round(highTemp - params.nightDrop + (rng() * 4 - 2));

  // --- Precipitation ---
  const precipRoll = rng() * 100;
  const isRaining = precipRoll < params.precipitation;
  let precipType = 'none';
  let precipIntensity = 'none';

  if (isRaining) {
    // Pick precipitation type
    const typeIndex = Math.floor(rng() * params.precipType.length);
    precipType = params.precipType[typeIndex];

    // Intensity
    const intensityRoll = rng();
    if (intensityRoll < 0.5) precipIntensity = 'light';
    else if (intensityRoll < 0.85) precipIntensity = 'moderate';
    else precipIntensity = 'heavy';

    // Temperature adjustment for precipitation
    // Rain cools slightly, snow means it's colder
    if (['snow', 'blizzard'].includes(precipType) && highTemp > 34) {
      // If it's snowing, cap temp at freezing-ish
      // (don't override completely, just nudge)
    }
  }

  // --- Wind ---
  const windVariance = rng() * 8 - 4;
  const windSpeed = Math.max(0, Math.round(params.windBase + windVariance));
  const gustChance = rng();
  const windGust = gustChance < 0.3
    ? Math.round(windSpeed + rng() * (params.windGust - params.windBase))
    : windSpeed;

  // --- Cloud Cover ---
  // Correlate with precipitation chance + some randomness
  const cloudBase = params.precipitation + (rng() * 20 - 10);
  const cloudCover = Math.clamp(Math.round(cloudBase), 0, 100);

  // --- Descriptive Text ---
  const tempDesc = _pickDescription(TEMP_DESCRIPTIONS, highTemp, rng);
  const windDesc = _pickDescription(WIND_DESCRIPTIONS, windSpeed, rng);
  const cloudDesc = _pickDescription(CLOUD_DESCRIPTIONS, cloudCover, rng);

  // --- Precipitation description ---
  let precipDesc = 'No precipitation';
  if (isRaining) {
    const intensityWord = precipIntensity === 'light' ? 'Light'
      : precipIntensity === 'moderate' ? 'Moderate'
      : 'Heavy';
    precipDesc = `${intensityWord} ${precipType}`;
  }

  return {
    // Raw data
    year,
    monthIndex,
    monthName,
    day,
    season,
    climate: climateKey,
    climateName: climate.name,

    // Temperature
    highTemp,
    lowTemp,
    tempDesc,

    // Precipitation
    isRaining,
    precipType,
    precipIntensity,
    precipDesc,

    // Wind
    windSpeed,
    windGust,
    windDesc,

    // Clouds
    cloudCover,
    cloudDesc,

    // Formatted summary
    summary: _buildWeatherSummary(highTemp, lowTemp, precipDesc, windDesc, cloudDesc, season, climate.name),
  };
}

function _pickDescription(table, value, rng) {
  for (const tier of table) {
    const maxKey = tier.maxTemp ?? tier.maxSpeed ?? tier.maxChance ?? 999;
    if (value <= maxKey) {
      const idx = Math.floor(rng() * tier.options.length);
      return tier.options[idx];
    }
  }
  const last = table[table.length - 1];
  return last.options[0];
}

function _buildWeatherSummary(high, low, precip, wind, clouds, season, climateName) {
  return `${climateName} — ${season.charAt(0).toUpperCase() + season.slice(1)}\n` +
    `High ${high}°F / Low ${low}°F\n` +
    `${clouds}. ${precip}. ${wind}.`;
}

/* ----------------------------------------------------------
   STATE MANAGEMENT
   Persists current climate zone and last generated weather
   in a world-level flag.
   ---------------------------------------------------------- */

async function _getWeatherState() {
  return game.settings.get(WE_MODULE_ID, 'weatherState') ?? {
    climateZone: 'temperate',
    lastWeather: null,
    lastDate: null,
    postToChat: true,
  };
}

async function _setWeatherState(state) {
  await game.settings.set(WE_MODULE_ID, 'weatherState', state);
}

/* ----------------------------------------------------------
   SIMPLE CALENDAR INTEGRATION
   Reads current date from Simple Calendar API.
   ---------------------------------------------------------- */

function _getCurrentDateFromSC() {
  // Simple Calendar API
  if (typeof SimpleCalendar === 'undefined') {
    console.warn(`${WE_MODULE_ID} | Weather: Simple Calendar not found`);
    return null;
  }

  const currentDate = SimpleCalendar.api.currentDateTime();
  if (!currentDate) return null;

  return {
    year: currentDate.year,
    monthIndex: currentDate.month,   // 0-indexed
    day: currentDate.day + 1,        // SC uses 0-indexed days, we want 1-indexed
  };
}

/* ----------------------------------------------------------
   GENERATE & DISPLAY
   ---------------------------------------------------------- */

async function generateTodayWeather(forceRegenerate = false) {
  if (!game.user.isGM) return null;

  const date = _getCurrentDateFromSC();
  if (!date) {
    console.warn(`${WE_MODULE_ID} | Weather: Could not read date from Simple Calendar`);
    return null;
  }

  const state = await _getWeatherState();
  const dateKey = `${date.year}-${date.monthIndex}-${date.day}`;

  // Check if we already generated weather for today
  if (!forceRegenerate && state.lastDate === dateKey && state.lastWeather) {
    console.log(`${WE_MODULE_ID} | Weather: Using cached weather for ${dateKey}`);
    return state.lastWeather;
  }

  // Generate new weather
  const weather = generateWeather(date.year, date.monthIndex, date.day, state.climateZone);
  if (!weather) return null;

  // Save state
  state.lastWeather = weather;
  state.lastDate = dateKey;
  await _setWeatherState(state);

  console.log(`${WE_MODULE_ID} | Weather: Generated for ${weather.monthName} ${weather.day}, ${weather.year} (${weather.climateName}, ${weather.season})`);
  console.log(`${WE_MODULE_ID} | Weather: ${weather.summary}`);

  return weather;
}

/* ----------------------------------------------------------
   CHAT OUTPUT
   Posts weather to chat in Croaker's Ledger style.
   ---------------------------------------------------------- */

function _postWeatherToChat(weather) {
  if (!weather) return;

  const precipColor = weather.isRaining
    ? 'var(--baph-blood, #6e2a22)'
    : 'var(--baph-ink-faint, #8a7b6e)';

  const content = `
    <div style="font-family: var(--baph-font-heading, 'Courier Prime', monospace); border-top: 2px solid var(--baph-brass, #9e7d43); padding-top: 4px;">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--baph-brass-readable, #846528); margin-bottom: 4px;">
        ☁ Weather — ${weather.monthName} ${weather.day}, ${weather.year} AR
      </div>
      <div style="font-family: var(--baph-font-body, 'Alegreya', serif); font-size: 12px; color: var(--baph-ink-primary, #2a231d); line-height: 1.5;">
        <div style="margin-bottom: 2px;">
          <strong style="font-family: var(--baph-font-mono, 'IBM Plex Mono', monospace);">${weather.highTemp}°F</strong> /
          <span style="color: var(--baph-ink-secondary, #5e5246);">${weather.lowTemp}°F</span>
          — ${weather.tempDesc}
        </div>
        <div style="margin-bottom: 2px; color: ${precipColor};">
          ${weather.precipDesc}
        </div>
        <div style="margin-bottom: 2px;">${weather.windDesc} (${weather.windSpeed} mph${weather.windGust > weather.windSpeed ? `, gusts ${weather.windGust}` : ''})</div>
        <div style="color: var(--baph-ink-secondary, #5e5246);">${weather.cloudDesc}</div>
      </div>
      <div style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--baph-ink-faint, #8a7b6e); margin-top: 4px; border-top: 1px solid var(--baph-leather-mid, #8a7b66); padding-top: 3px;">
        ${weather.climateName} · ${weather.season}
      </div>
    </div>
  `;

  ChatMessage.create({
    content,
    speaker: { alias: "The Ledger" },
    whisper: game.users.filter(u => u.isGM).map(u => u.id),
  });
}

/* ----------------------------------------------------------
   HOOKS & INITIALIZATION
   ---------------------------------------------------------- */

Hooks.once('init', () => {
  // Register weather state setting
  game.settings.register(WE_MODULE_ID, 'weatherState', {
    name: 'Weather Engine State',
    scope: 'world',
    config: false,
    type: Object,
    default: {
      climateZone: 'temperate',
      lastWeather: null,
      lastDate: null,
      postToChat: true,
    }
  });

  console.log(`${WE_MODULE_ID} | Weather Engine v1.0: Settings registered`);
});

Hooks.once('ready', async () => {
  if (!game.user.isGM) return;

  // Generate weather for current day on load
  const weather = await generateTodayWeather();
  if (weather) {
    console.log(`${WE_MODULE_ID} | Weather Engine v1.0 ready — ${weather.climateName}, ${weather.season}`);
    console.log(`${WE_MODULE_ID} | Current weather: ${weather.highTemp}°F/${weather.lowTemp}°F, ${weather.precipDesc}`);
  } else {
    console.log(`${WE_MODULE_ID} | Weather Engine v1.0 ready — no Simple Calendar date available`);
  }

  // Expose API
  game.baphometWeather = {
    /** Generate (or retrieve cached) today's weather */
    today: generateTodayWeather,

    /** Force regenerate today's weather */
    reroll: () => generateTodayWeather(true),

    /** Post current weather to chat (GM whisper) */
    post: async () => {
      const weather = await generateTodayWeather();
      _postWeatherToChat(weather);
    },

    /** Get/set climate zone */
    getClimate: async () => (await _getWeatherState()).climateZone,
    setClimate: async (zoneKey) => {
      if (!GOLARION_CLIMATES[zoneKey]) {
        const valid = Object.keys(GOLARION_CLIMATES).join(', ');
        console.error(`${WE_MODULE_ID} | Invalid climate zone "${zoneKey}". Valid: ${valid}`);
        return;
      }
      const state = await _getWeatherState();
      state.climateZone = zoneKey;
      state.lastWeather = null;  // Force regeneration
      state.lastDate = null;
      await _setWeatherState(state);
      console.log(`${WE_MODULE_ID} | Climate zone changed to: ${GOLARION_CLIMATES[zoneKey].name}`);
      const weather = await generateTodayWeather(true);
      _postWeatherToChat(weather);
    },

    /** List available climate zones */
    listClimates: () => {
      console.log(`${WE_MODULE_ID} | Available climate zones:`);
      for (const [key, zone] of Object.entries(GOLARION_CLIMATES)) {
        console.log(`  ${key}: ${zone.name} — ${zone.description}`);
      }
      return Object.keys(GOLARION_CLIMATES);
    },

    /** Toggle chat posting on day advance */
    toggleChat: async () => {
      const state = await _getWeatherState();
      state.postToChat = !state.postToChat;
      await _setWeatherState(state);
      console.log(`${WE_MODULE_ID} | Weather chat posting: ${state.postToChat ? 'ON' : 'OFF'}`);
    },

    /** Get raw weather data for a specific date */
    getWeatherFor: (year, monthIndex, day, climateKey) => {
      const key = climateKey ?? _getWeatherState().then(s => s.climateZone) ?? 'temperate';
      return generateWeather(year, monthIndex, day, typeof key === 'string' ? key : 'temperate');
    },
  };
});

/* ── Simple Calendar date change hook ──────────────────────
   Fires when the GM advances the date.
   Generates new weather and optionally posts to chat. */
Hooks.on('simple-calendar-date-time-change', async (data) => {
  if (!game.user.isGM) return;

  console.log(`${WE_MODULE_ID} | Weather: Simple Calendar date changed`, data);

  const weather = await generateTodayWeather(true);
  if (!weather) return;

  const state = await _getWeatherState();
  if (state.postToChat) {
    _postWeatherToChat(weather);
  }
});
