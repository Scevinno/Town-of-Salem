// Initialize Supabase client
const SUPABASE_URL = "https://kvlvfrnrudvdhmdombfz.supabase.co";
const SUPABASE_KEY = "sb_publishable_PXy-ingTPKFctbL9u9DYwQ_5FlJY4rJ";
const SKULL_URL = "https://kvlvfrnrudvdhmdombfz.supabase.co/storage/v1/object/public/Town%20of%20Salem%20Files/skull.png";

// Create client (IMPORTANT: do NOT name this variable 'supabase')
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
window.screenCache = {};
window.scrollMemory = {};

// Test connection
async function testConnection() {
  const app = document.getElementById('app');

  const { data, error } = await client
    .from('characters')
    .select('*')
    .limit(1);

  if (error) {
    console.error(error);
  } 
}

testConnection();

// Handle login
document.getElementById("continueBtn").addEventListener("click", () => {
  const username = document.getElementById("username").value.trim();
  const role = document.getElementById("role").value;

  if (!username) {
    alert("Please enter a username");
    return;
  }

  localStorage.setItem("username", username);
  localStorage.setItem("role", role);

  loadCharacterHome();
});

(function checkQRJoin() {
  const params = new URLSearchParams(window.location.search);
  const joinCode = params.get("join");

  if (joinCode && /^[0-9]{8}$/.test(joinCode)) {
    // Store code temporarily so Join Game screen can auto-fill
    localStorage.setItem("qrJoinCode", joinCode);
  }
})();

async function loadCharacterHome() {
  // If cached, restore instantly
  if (window.screenCache["characterHome"]) {
    document.getElementById("app").innerHTML = window.screenCache["characterHome"];

    // Restore scroll position on the same container that actually scrolls
    const container = document.getElementById("app");
    const y = window.scrollMemory["characterHome"] || 0;
    requestAnimationFrame(() => {
      if (container) container.scrollTop = y;
    });

    return;
  }

  const role = localStorage.getItem("role");

  // Update header status
  document.getElementById("header-status").innerHTML =
    `<b>${localStorage.getItem("username")}</b>, you are logged in as ${localStorage.getItem("role")}`;

  // Render fresh HTML
  document.getElementById("app").innerHTML = `
    <div class="character-home">

      <input id="searchBar" type="text" placeholder="Search characters...">

      <div id="characterList" class="character-list">
        <p>Loading characters...</p>
      </div>

      ${role === "admin" ? `
        <button id="addCharacterBtn" class="bottom-action-btn" style="background:#3b82f6;">
          Add Character
        </button>
      ` : ""}

      <button id="actionBtn" class="bottom-action-btn">
        ${role === "admin" ? "Manage Games" : "Join Game"}
      </button>

      <button id="logoutBtn" class="bottom-action-btn" style="background:#ef4444;">
        Logout
      </button>

    </div>
  `;

  // Attach listeners
  document.getElementById("searchBar").addEventListener("input", filterCharacters);

  document.getElementById("actionBtn").addEventListener("click", () => {
    if (role === "admin") loadManageGames();
    else {
      const activeLobby = localStorage.getItem("activeLobby");
      const playerId = localStorage.getItem("playerId");

      if (activeLobby && playerId) {
        enterPlayerGame(activeLobby);
      } else {
        loadJoinGame();
      }
    }
  });

  if (role === "admin") {
    document.getElementById("addCharacterBtn").addEventListener("click", () => {
      delete window.screenCache["characterHome"]; // invalidate cache
      openCharacterForm();
    });
  }

  document.getElementById("logoutBtn").addEventListener("click", logout);

  // Load characters from DB
  await loadCharactersFromDB();

  // Save final rendered screen to cache
  window.screenCache["characterHome"] = document.getElementById("app").innerHTML;
}

async function loadCharactersFromDB() {
  const list = document.getElementById("characterList");
  
  const { data, error } = await client
    .from("characters")
    .select("*")
    .order("name");

  if (error) {
    list.innerHTML = "<p>Error loading characters.</p>";
    console.error(error);
    return;
  }

  window.allCharacters = data;
  renderCharacterList(data);
}

function renderCharacterList(characters) {
  const list = document.getElementById("characterList");

  list.innerHTML = characters.map(c => `
    <div class="character-card" onclick="saveHomeScroll(); openCharacterDetail('${c.id}')">
      <img loading="lazy" src="${c.image_url}" alt="${c.name}">
      <h3>${c.name}</h3>
      <p class="faction-${c.faction.toLowerCase()}">${c.faction} ${c.type}</p>
    </div>
  `).join("");
}

function filterCharacters() {
  const query = document.getElementById("searchBar").value.toLowerCase();

  const filtered = window.allCharacters.filter(c =>
    c.name.toLowerCase().includes(query) ||
    c.type.toLowerCase().includes(query) ||
    c.faction.toLowerCase().includes(query)
  );

  renderCharacterList(filtered);
}

function openCharacterDetail(id) {
  const c = window.allCharacters.find(x => x.id == id);
  const role = localStorage.getItem("role");

  // If cached, restore instantly
  if (window.screenCache[`characterDetail_${id}`]) {
    document.getElementById("app").innerHTML = window.screenCache[`characterDetail_${id}`];
    return;
  }

  const factionClass = {
    "Town": "faction-town",
    "Mafia": "faction-mafia",
    "Coven": "faction-coven",
    "Neutral": "faction-neutral"
  }[c.faction] || "";

  // Render fresh HTML
  document.getElementById("app").innerHTML = `
    <div class="character-detail">

      <div class="character-detail-content">
        <img src="${c.image_url}" alt="${c.name}">

        <h1>${c.name}</h1>
        <h2 class="${factionClass}">${c.faction} ${c.type}</h2>

        <h4>Summary</h4>
        <div class="rich-text">${c.summary}</div>

        <h4>Ability</h4>
        <div class="rich-text">${c.ability}</div>
      </div>

      <div class="detail-actions">
        ${role === "admin" ? `
          <button onclick="invalidateCharacterDetailCache('${c.id}'); openCharacterForm('${c.id}')"
                  class="bottom-action-btn" style="background:#3b82f6;">
            Edit
          </button>
        ` : ""}

        <button onclick="loadCharacterHome()" class="bottom-action-btn">
          Back
        </button>
      </div>

    </div>
  `;

  // Save to cache
  window.screenCache[`characterDetail_${id}`] = document.getElementById("app").innerHTML;
}

function invalidateCharacterDetailCache(id) {
  delete window.screenCache[`characterDetail_${id}`];
  delete window.screenCache["characterHome"]; // home must refresh too
}

function saveHomeScroll() {
  const container = document.getElementById("app");
  if (!container) return;
  window.scrollMemory["characterHome"] = container.scrollTop || 0;
}

function openCharacterForm(id = null) {
  let c = null;

  if (id) {
    c = window.allCharacters.find(x => x.id == id);
  }

  document.getElementById("app").innerHTML = `
    <div class="character-detail">

      <div class="character-detail-content">

        <h2>${id ? "Edit Character" : "Create New Character"}</h2>

        <label class="edit-label">Name</label>
        <input id="charName" class="edit-field" type="text" value="${c ? c.name : ""}">

        <label class="edit-label">Faction</label>
        <select id="charFaction" class="edit-field">
          <option ${c?.faction === "Town" ? "selected" : ""}>Town</option>
          <option ${c?.faction === "Mafia" ? "selected" : ""}>Mafia</option>
          <option ${c?.faction === "Coven" ? "selected" : ""}>Coven</option>
          <option ${c?.faction === "Neutral" ? "selected" : ""}>Neutral</option>
        </select>

        <label class="edit-label">Type</label>
        <select id="charType" class="edit-field">
          <option ${c?.type === "Power" ? "selected" : ""}>Power</option>
          <option ${c?.type === "Protective" ? "selected" : ""}>Protective</option>
          <option ${c?.type === "Investigative" ? "selected" : ""}>Investigative</option>
          <option ${c?.type === "Support" ? "selected" : ""}>Support</option>
          <option ${c?.type === "Deceptive" ? "selected" : ""}>Deceptive</option>
          <option ${c?.type === "Killing" ? "selected" : ""}>Killing</option>
          <option ${c?.type === "Chaos" ? "selected" : ""}>Chaos</option>
        </select>

        <label class="edit-label">Summary</label>
        <textarea id="charSummary" class="edit-field">${c ? c.summary : ""}</textarea>

        <label class="edit-label">Ability</label>
        <textarea id="charAbility" class="edit-field">${c ? c.ability : ""}</textarea>

        <label class="edit-label">Image</label>
        <input id="charImage" class="edit-field" type="file" accept="image/*">

      </div>

      <div class="detail-actions">
        <button onclick="saveCharacterForm(${id ? `'${id}'` : "null"})"
          class="bottom-action-btn" style="background:#22c55e;">
          Save
        </button>

        <button onclick="${id ? `openCharacterDetail('${id}')` : "loadCharacterHome()"}"
          class="bottom-action-btn">
          Cancel
        </button>
      </div>

    </div>
  `;
}

async function saveCharacterForm(id = null) {
  const name = document.getElementById("charName").value.trim();
  const faction = document.getElementById("charFaction").value;
  const type = document.getElementById("charType").value;
  const summary = document.getElementById("charSummary").value.trim();
  const ability = document.getElementById("charAbility").value.trim();
  const imageFile = document.getElementById("charImage").files[0];

  if (!name || !summary || !ability) {
    alert("All fields must be filled.");
    return;
  }

  let image_url = null;

  // INSERT MODE
  if (!id) {
    const { data, error } = await client
      .from("characters")
      .insert([{ name, faction, type, summary, ability }])
      .select()
      .single();

    if (error) {
      alert("Failed to create character");
      console.error(error);
      return;
    }

    id = data.id;
  }

  // IMAGE UPLOAD (optional)
  if (imageFile) {
    const filePath = `${id}-${Date.now()}.png`;

    const { error: uploadError } = await client.storage
      .from("Town of Salem Files")
      .upload(filePath, imageFile, {
        cacheControl: "2628000",
        upsert: true
      });

    if (uploadError) {
      alert("Image upload failed");
      console.error(uploadError);
      return;
    }

    image_url = client.storage
      .from("Town of Salem Files")
      .getPublicUrl(filePath).data.publicUrl;
  }

  // UPDATE MODE (or update after insert)
  const { error: updateError } = await client
    .from("characters")
    .update({
      name,
      faction,
      type,
      summary,
      ability,
      ...(image_url ? { image_url } : {})
    })
    .eq("id", id);

  if (updateError) {
    alert("Failed to save changes");
    console.error(updateError);
    return;
  }

  alert("Character saved!");
  loadCharacterHome();
}

function logout() {
  localStorage.removeItem("username");
  localStorage.removeItem("role");
  location.reload();
}

function loadManageGames() {
  document.getElementById("app").innerHTML = `
    <div class="lobby-screen">

      <div class="character-detail-content">
        <h2>Manage Games</h2>

        <div id="gamesList" class="games-list">
          <p>Loading games...</p>
        </div>
      </div>

      <div class="detail-actions">
        <button onclick="openNewGameForm()" class="bottom-action-btn" style="background:#3b82f6;">
          New Game
        </button>

        <button onclick="loadCharacterHome()" class="bottom-action-btn">
          Back
        </button>
      </div>

    </div>
  `;

  loadGamesFromDB();
}

function renderGameCard(game) {
  const joinUrl = `${window.location.origin}?join=${game.code}`;

  return `
    <div class="game-card">
      <h3>${game.lobby_name}</h3>
      <p>${game.current_players} / ${game.max_players} players</p>
      <p>Code: <b>${game.code}</b></p>

      <div class="qr-wrapper">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(joinUrl)}">
      </div>

      <button class="bottom-action-btn" style="background:#22c55e;margin-top:10px;"
        onclick="launchGame('${game.id}')">
        Launch
      </button>

      <button class="terminate-btn" onclick="confirmTerminateGame('${game.id}')">
        Terminate
      </button>
    </div>
  `;
}

function confirmTerminateGame(lobbyId) {
  const ok = confirm("Are you sure you want to terminate this game? This will remove all players and the lobby.");
  if (!ok) return;
  terminateGame(lobbyId);
}

async function terminateGame(lobbyId) {
  // delete players first
  const { error: playersError } = await client
    .from("players")
    .delete()
    .eq("lobby_id", lobbyId);

  if (playersError) {
    alert("Failed to remove players.");
    console.error(playersError);
    return;
  }

  // then delete lobby
  const { error: lobbyError } = await client
    .from("lobbies")
    .delete()
    .eq("id", lobbyId);

  if (lobbyError) {
    alert("Failed to terminate game.");
    console.error(lobbyError);
    return;
  }

  loadManageGames();
}

async function loadGamesFromDB() {
  const list = document.getElementById("gamesList");

  const { data, error } = await client
    .from("lobbies")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    list.innerHTML = "<p>Error loading games.</p>";
    return;
  }

  if (!data.length) {
    list.innerHTML = "<p>No active games.</p>";
    return;
  }

  list.innerHTML = data.map(renderGameCard).join("");
}

function openNewGameForm() {
  document.getElementById("app").innerHTML = `
    <div class="character-detail">

      <div class="character-detail-content">

        <h2>Create New Game</h2>

        <label class="edit-label">Lobby Name</label>
        <input id="lobbyName" class="edit-field" type="text">

        <label class="edit-label">Number of Players</label>
        <select id="playerCount" class="edit-field">
          ${Array.from({ length: 16 }, (_, i) => `<option>${i + 1}</option>`).join("")}
        </select>

        <div id="playerSlots"></div>

      </div>

      <div class="detail-actions">
        <button onclick="launchNewGame()" class="bottom-action-btn" style="background:#22c55e;">
          Launch
        </button>

        <button onclick="loadManageGames()" class="bottom-action-btn">
          Cancel
        </button>
      </div>

    </div>
  `;

  document.getElementById("playerCount").addEventListener("change", updatePlayerSlots);
  updatePlayerSlots();
}

function updatePlayerSlots() {
  const count = Number(document.getElementById("playerCount").value);
  const container = document.getElementById("playerSlots");

  container.innerHTML = Array.from({ length: count }, (_, i) => `
    <label class="edit-label">Player ${i + 1}</label>
    <select class="edit-field player-role">
      ${window.allCharacters.map(c => `<option value="${c.id}">${c.name}</option>`).join("")}
    </select>
  `).join("");
}

function generate8DigitCode() {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return (array[0] % 90000000 + 10000000).toString();
}

async function launchNewGame() {
  const lobbyName = document.getElementById("lobbyName").value.trim();
  const count = Number(document.getElementById("playerCount").value);
  const roles = [...document.querySelectorAll(".player-role")].map(s => s.value);

  if (!lobbyName || roles.length !== count) {
    alert("Please fill all fields.");
    return;
  }

  const code = generate8DigitCode();

  const { error } = await client
    .from("lobbies")
    .insert([{
      code,
      lobby_name: lobbyName,
      max_players: count,
      selected_character_ids: roles
    }]);

  if (error) {
    alert("Failed to create game.");
    console.error(error);
    return;
  }

  loadManageGames();
}

async function launchGame(lobbyId) {
  // clear any previous night timer
  if (window.nightTimerInterval) {
    clearInterval(window.nightTimerInterval);
    window.nightTimerInterval = null;
  }

  const { data: lobbies, error: lobbyError } = await client
    .from("lobbies")
    .select("*")
    .eq("id", lobbyId)
    .single();

  if (lobbyError || !lobbies) {
    alert("Failed to load lobby.");
    console.error(lobbyError);
    return;
  }

  const lobby = lobbies;

  const { data: players, error: playersError } = await client
    .from("players")
    .select("*, characters(*)")
    .eq("lobby_id", lobbyId)
    .order("joined_at", { ascending: true });

  if (playersError) {
    alert("Failed to load players.");
    console.error(playersError);
    return;
  }

  // ensure starting state
  if (lobby.phase === "waiting") {
    lobby.phase = "day";
    lobby.day_number = 1;
    lobby.night_number = 0;
    await client.from("lobbies")
      .update({ phase: "day", day_number: 1, night_number: 0, accepting_responses: false })
      .eq("id", lobbyId);
  }

  if (lobby.phase === "day") {
    renderDayPhase(lobby, players);
  } else if (lobby.phase === "night") {
    renderNightPhase(lobby, players);
  }
}

async function renderDayPhase(lobby, players) {
  const day = lobby.day_number || 1;

  const { data: nightActions, error: naErr } = await client
    .from("night_actions")
    .select("*, target:target_player_id(username)")
    .eq("lobby_id", lobby.id);

  if (naErr) console.error("Failed to load night actions:", naErr);

  document.getElementById("app").innerHTML = `
    <div class="lobby-screen">
      <div class="character-detail-content">
        <h2>Day ${day}</h2>

        <div class="games-list">
          ${players.map((p, idx) =>
            renderAdminPlayerCard(p, idx + 1, nightActions, true, players)
          ).join("")}
        </div>
      </div>

      <div class="detail-actions">
        ${day < 7 ? `
          <button class="bottom-action-btn" onclick="goToNight('${lobby.id}')">
            Night ${day}
          </button>
        ` : `
          <button class="bottom-action-btn" disabled>
            Game complete (Day 7 reached)
          </button>
        `}
        <button class="bottom-action-btn" onclick="loadManageGames()">
          Back to Manage Games
        </button>
      </div>
    </div>
  `;
}

async function togglePlayerActive(playerId, makeActive) {
  const { error } = await client
    .from("players")
    .update({ is_active: makeActive, is_alive: makeActive })
    .eq("id", playerId);

  if (error) {
    alert("Failed to update player.");
    console.error(error);
    return;
  }

  // reload current view by re-launching current lobby
  // we need lobby_id, so fetch player quickly
  const { data: player, error: pErr } = await client
    .from("players")
    .select("lobby_id")
    .eq("id", playerId)
    .single();

  if (!pErr && player) {
    launchGame(player.lobby_id);
  }
}

async function adminChangeRole(playerId, newCharacterId) {
  if (!newCharacterId) return;

  const { error } = await client
    .from("players")
    .update({ character_id: newCharacterId })
    .eq("id", playerId);

  if (error) {
    alert("Failed to change role.");
    console.error(error);
    return;
  }

  // Reload admin view
  const { data: player, error: pErr } = await client
    .from("players")
    .select("lobby_id")
    .eq("id", playerId)
    .single();

  if (!pErr && player) {
    launchGame(player.lobby_id);
  }
}

async function goToNight(lobbyId) {
  const { data: lobby, error } = await client
    .from("lobbies")
    .select("*")
    .eq("id", lobbyId)
    .single();

  if (error || !lobby) {
    alert("Failed to load lobby.");
    console.error(error);
    return;
  }

  const nightNumber = (lobby.night_number || 0) + 1;

  await client.from("lobbies")
    .update({
      phase: "night",
      night_number: nightNumber,
      accepting_responses: true
    })
    .eq("id", lobbyId);

  const { data: players, error: playersError } = await client
    .from("players")
    .select("*, characters(*)")
    .eq("lobby_id", lobbyId)
    .order("joined_at", { ascending: true });

  if (playersError) {
    alert("Failed to load players.");
    console.error(playersError);
    return;
  }

  renderNightPhase({ ...lobby, night_number: nightNumber, phase: "night" }, players);
}

async function renderNightPhase(lobby, players) {
  const night = lobby.night_number || 1;
  let remaining = 60;

  const { data: nightActions, error: naErr } = await client
    .from("night_actions")
    .select("*, target:target_player_id(username)")
    .eq("lobby_id", lobby.id);

  if (naErr) console.error("Failed to load night actions:", naErr);

  document.getElementById("app").innerHTML = `
    <div class="lobby-screen">
      <div class="character-detail-content">
        <h2>Night ${night}</h2>
        <div id="night-timer" style="margin-bottom:10px;font-weight:bold;">60s</div>

        <div class="games-list">
          ${players.map((p, idx) =>
            renderAdminPlayerCard(p, idx + 1, nightActions, false, players)
          ).join("")}
        </div>
      </div>

      <div class="detail-actions">
        <button class="bottom-action-btn" style="background:#f97316;" onclick="pauseNightTimer()">
          Pause
        </button>
        <button class="bottom-action-btn" onclick="loadManageGames()">
          Back to Manage Games
        </button>
      </div>
    </div>
  `;

  if (window.nightTimerInterval) clearInterval(window.nightTimerInterval);

  window.nightTimerPaused = false;
  window.nightTimerInterval = setInterval(async () => {
    if (window.nightTimerPaused) return;
    remaining -= 1;
    const el = document.getElementById("night-timer");
    if (el) el.textContent = `${remaining}s`;

    if (remaining <= 0) {
      clearInterval(window.nightTimerInterval);
      window.nightTimerInterval = null;
      await advanceToNextDay(lobby.id);
    }
  }, 1000);
}

function renderAdminPlayerCard(player, roleIndex, nightActions, showButtons, players) {
  const c = player.characters;

  const factionClass = {
    "Town": "faction-town",
    "Mafia": "faction-mafia",
    "Coven": "faction-coven",
    "Neutral": "faction-neutral"
  }[c?.faction] || "";

  const isInactive = !player.is_active || !player.is_alive;
  const cardClass = isInactive ? "game-card inactive-player" : "game-card";

  return `
    <div class="${cardClass}">

      <div class="player-row ${factionClass}">
        <div class="player-info">
          <b>${roleIndex}</b> — <b>${player.username}</b><br>
          <span>${c ? `${c.name} (${c.faction})` : ""}</span>
        </div>

        ${isInactive ? `
          <div class="player-icon">
            <img src="${SKULL_URL}" class="skull-icon">
          </div>
        ` : ""}
      </div>

      <div class="night-table-grid">
        <div class="night-row-header">
          ${["N1","N2","N3","N4","N5","N6"].map(n => `
            <div class="night-cell">${n}</div>
          `).join("")}
        </div>

        <div class="night-row-actions">
          ${Array(6).fill("").map((_, i) => {
            const nightNum = i + 1;
            const actionsForNight = (nightActions || [])
              .filter(a => a.player_id === player.id && a.night_number === nightNum)
              .sort((a, b) => a.visit_index - b.visit_index);

            let cellText = "";
            if (actionsForNight.length === 1) {
              const t1 = players.find(p => p.id === actionsForNight[0].target_player_id);
              if (t1) cellText = (players.indexOf(t1) + 1).toString();
            } else if (actionsForNight.length >= 2) {
              const t1 = players.find(p => p.id === actionsForNight[0].target_player_id);
              const t2 = players.find(p => p.id === actionsForNight[1].target_player_id);
              const i1 = t1 ? (players.indexOf(t1) + 1) : "";
              const i2 = t2 ? (players.indexOf(t2) + 1) : "";
              cellText = `${i1}→${i2}`;
            }

            return `<div class="night-cell">${cellText}</div>`;
          }).join("")}
        </div>
      </div>

      ${showButtons ? `
        <button class="bottom-action-btn"
          style="margin-top:10px;background:${isInactive ? "#22c55e" : "#ef4444"}"
          onclick="togglePlayerActive('${player.id}', ${isInactive})">
          ${isInactive ? "Reactivate" : "Deactivate"}
        </button>

        <!-- NEW: Change Role Dropdown -->
        <select class="edit-field"
                style="margin-top:10px;width:100%;"
                onchange="adminChangeRole('${player.id}', this.value)">
          <option value="">Change role...</option>
          ${window.allCharacters
            .map(ch => `<option value="${ch.id}">${ch.name}</option>`)
            .join("")}
        </select>
      ` : ""}

    </div>
  `;
}

function pauseNightTimer() {
  window.nightTimerPaused = !window.nightTimerPaused;
}

async function advanceToNextDay(lobbyId) {
  const { data: lobby, error } = await client
    .from("lobbies")
    .select("*")
    .eq("id", lobbyId)
    .single();

  if (error || !lobby) {
    console.error(error);
    return;
  }

  const nightNumber = lobby.night_number;   // <-- needed for resolution
  const nextDay = (lobby.day_number || 1) + 1;

  // --- NIGHT RESOLUTION GOES HERE ---
  await resolveCultistConversion(lobbyId, nightNumber)
  await resolveMayorProsecutorReveal(lobbyId, nightNumber);

  if (nextDay > 7) {
    await client.from("lobbies")
      .update({ phase: "finished", accepting_responses: false })
      .eq("id", lobbyId);
    loadManageGames();
    return;
  }

  await client.from("lobbies")
    .update({
      phase: "day",
      day_number: nextDay,
      accepting_responses: false
    })
    .eq("id", lobbyId);

  const { data: players, error: playersError } = await client
    .from("players")
    .select("*, characters(*)")
    .eq("lobby_id", lobbyId)
    .order("joined_at", { ascending: true });

  if (playersError) {
    console.error(playersError);
    return;
  }

  renderDayPhase({ ...lobby, day_number: nextDay, phase: "day" }, players);
}

function loadJoinGame() {
  const qrCode = localStorage.getItem("qrJoinCode");

  document.getElementById("app").innerHTML = `
    <div class="character-detail">

      <div class="character-detail-content">
        <h2>Join Game</h2>

        <label class="edit-label">Enter 8-digit Code</label>
        <input id="joinCode" class="edit-field" type="text" maxlength="8" value="${qrCode || ""}">

        <button class="bottom-action-btn" onclick="joinGameByCode()">
          Join via Code
        </button>

        <button class="bottom-action-btn" style="background:#3b82f6;" onclick="joinGameByQR()">
          Join via QR
        </button>
      </div>

      <div class="detail-actions">
        <button class="bottom-action-btn" onclick="loadCharacterHome()">
          Back
        </button>
      </div>

    </div>
  `;

  if (qrCode) {
    localStorage.removeItem("qrJoinCode");
    joinGameByCode();
  }
}

async function joinGameByCode() {
  const code = document.getElementById("joinCode").value.trim();
  const username = localStorage.getItem("username");

  if (!/^[0-9]{8}$/.test(code)) {
    alert("Invalid code.");
    return;
  }

  // Check if lobby exists
  const { data: lobby, error } = await client
    .from("lobbies")
    .select("*")
    .eq("code", code)
    .single();

  if (error || !lobby) {
    alert("Lobby not found.");
    return;
  }

  await joinLobby(lobby.id, username);
}

function joinGameByQR() {
  // Use native camera API
  navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
    .then(stream => {
      // Show scanner UI
      openQRScanner(stream);
    })
    .catch(() => alert("Camera access denied."));
}

async function joinLobby(lobbyId, username) {
  // 1) Ensure username exists
  if (!username) {
    const input = prompt("Enter a username:");
    if (!input) return;
    username = input.trim();
    localStorage.setItem("username", username);
  }

  // 2) Check if player already exists in this lobby
  const { data: existing } = await client
    .from("players")
    .select("id, character_id")
    .eq("lobby_id", lobbyId)
    .eq("username", username)
    .single();

  if (existing) {
    localStorage.setItem("activeLobby", lobbyId);   // UUID
    localStorage.setItem("playerId", existing.id);
    return enterPlayerGame(lobbyId);
  }

  // 3) Fetch lobby
  const { data: lobby, error: lobbyErr } = await client
    .from("lobbies")
    .select("id, selected_character_ids, current_players")
    .eq("id", lobbyId)
    .single();

  if (lobbyErr || !lobby) {
    alert("Lobby not found.");
    console.error(lobbyErr);
    return;
  }

  const roles = lobby.selected_character_ids || [];

  // 4) Fetch current players to see which roles are taken
  const { data: players, error: playersErr } = await client
    .from("players")
    .select("character_id")
    .eq("lobby_id", lobbyId);

  if (playersErr) {
    alert("Failed to load players.");
    console.error(playersErr);
    return;
  }

  const taken = players.map(p => p.character_id);
  const available = roles.filter(r => !taken.includes(r));

  if (!available.length) {
    alert("Lobby is full.");
    return;
  }

  // 5) Randomly assign one available role
  const assignedRoleId = available[Math.floor(Math.random() * available.length)];

  // 6) Insert player
  const { data: newPlayer, error: insertErr } = await client
    .from("players")
    .insert([{
      lobby_id: lobbyId,
      username,
      is_active: true,
      is_alive: true,
      character_id: assignedRoleId
    }])
    .select("id, character_id")
    .single();

  if (insertErr) {
    alert("Failed to join lobby.");
    console.error(insertErr);
    return;
  }

  // 7) Increment lobby player count
  await client
    .from("lobbies")
    .update({ current_players: (lobby.current_players || 0) + 1 })
    .eq("id", lobbyId);

  // 8) Store UUIDs
  localStorage.setItem("activeLobby", lobbyId);
  localStorage.setItem("playerId", newPlayer.id);

  // 9) Enter game
  enterPlayerGame(lobbyId);
}

async function enterPlayerGame(lobbyId) {
  const playerId = localStorage.getItem("playerId");
  window.nightPlayers = null;

  const { data: lobby, error: lobbyErr } = await client
    .from("lobbies")
    .select("*")
    .eq("id", lobbyId)
    .single();

  // If lobby doesn't exist anymore (terminated / wrong id), reset and go back to Join
  if (lobbyErr || !lobby) {
    console.error("Failed to load lobby:", lobbyErr);
    alert("This game no longer exists or cannot be loaded. Please join again.");

    localStorage.removeItem("activeLobby");
    localStorage.removeItem("playerId");

    loadJoinGame();
    return;
  }

  const { data: player, error: playerErr } = await client
    .from("players")
    .select("id, username, is_revealed, is_active, is_alive, cultist_used, character_id, characters(*)")
    .eq("id", playerId)
    .single();

  if (playerErr || !player) {
    console.error("Failed to load player:", playerErr);
    alert("Failed to load your player. Please join again.");

    localStorage.removeItem("activeLobby");
    localStorage.removeItem("playerId");

    loadJoinGame();
    return;
  }

  if (lobby.phase === "waiting") {
    return renderWaitingScreen(lobby, player);
  }

  if (lobby.phase === "day") {
    return renderPlayerDay(lobby, player);
  }

  if (lobby.phase === "night") {
    return renderPlayerNight(lobby, player);
  }
}

function renderWaitingScreen(lobby, player) {
  const c = player.characters;

  document.getElementById("app").innerHTML = `
    <div class="lobby-screen">
      <div class="character-detail-content">
        <h2>Waiting for game to start...</h2>
        <p>Lobby: ${lobby.lobby_name}</p>
        <p>Code: ${lobby.code}</p>

        <div class="game-card" style="margin-top:20px;">
          <h3>${c.name}</h3>
          <div>${c.faction} — ${c.type}</div>
          <p>${c.summary || ""}</p>
        </div>
      </div>

      <div class="detail-actions">
        <button class="bottom-action-btn" onclick="renderMyRole()">
          My Role
        </button>
        <button class="bottom-action-btn" style="background:#ef4444;" onclick="leaveGame()">
          Leave
        </button>
      </div>
    </div>
  `;

  if (window.waitInterval) clearInterval(window.waitInterval);

  window.waitInterval = setInterval(async () => {
    const { data: updated } = await client
      .from("lobbies")
      .select("phase")
      .eq("id", lobby.id)
      .single();

    if (updated && updated.phase !== "waiting") {
      clearInterval(window.waitInterval);
      enterPlayerGame(lobby.id);
    }
  }, 2000);
}

async function renderPlayerDay(lobby, player) {
  const { data: players } = await client
    .from("players")
    .select("id, username, is_revealed, is_active, is_alive, cultist_used, character_id, characters(*)")
    .eq("lobby_id", lobby.id)
    .order("username", { ascending: true });

  document.getElementById("app").innerHTML = `
    <div class="lobby-screen">
      <div class="character-detail-content">
        <h2>Day ${lobby.day_number}</h2>

        <div class="games-list">
          ${players.map((p, idx) =>
            renderPlayerCardForPlayer(p, idx + 1, player)
          ).join("")}
        </div>
      </div>

      <div class="detail-actions">
        <button class="bottom-action-btn" onclick="renderMyRole()">
          My Role
        </button>

        <button class="bottom-action-btn" style="background:#ef4444;" onclick="leaveGame()">
          Leave
        </button>
      </div>
    </div>
  `;

  pollPhaseChange(lobby.id, lobby.phase);
}

function canSeeRole(viewer, target) {
  if (!viewer.characters || !target.characters) return false;

  const vFaction = viewer.characters.faction;
  const tFaction = target.characters.faction;
  const tRole = target.characters.name;

  // Jailor is globally visible
  if (tRole === "Jailor") return true;

  // Mayor & Prosecutor become globally visible after reveal
  if (target.is_revealed) return true;

  // Mafia sees Mafia
  if (vFaction === "Mafia" && tFaction === "Mafia") return true;

  // Coven sees Coven
  if (vFaction === "Coven" && tFaction === "Coven") return true;

  // Otherwise only see yourself
  return viewer.id === target.id;
}

function pollPhaseChange(lobbyId, initialPhase) {
  if (window.phasePoll) clearInterval(window.phasePoll);

  let lastPhase = initialPhase;

  window.phasePoll = setInterval(async () => {
    const { data: lobby, error } = await client
      .from("lobbies")
      .select("phase, day_number, night_number")
      .eq("id", lobbyId)
      .single();

    if (error || !lobby) return;

    if (lobby.phase !== lastPhase) {
      // phase actually changed → update and reload
      lastPhase = lobby.phase;
      clearInterval(window.phasePoll);
      enterPlayerGame(lobbyId);
    }
  }, 1500);
}

function getFactionClass(player) {
  const faction = player.characters?.faction;
  return {
    "Town": "faction-town",
    "Mafia": "faction-mafia",
    "Coven": "faction-coven",
    "Neutral": "faction-neutral"
  }[faction] || "";
}

function openMyRoleDetail(c, lobbyId) {
  const factionClass = {
    "Town": "faction-town",
    "Mafia": "faction-mafia",
    "Coven": "faction-coven",
    "Neutral": "faction-neutral"
  }[c.faction] || "";

  document.getElementById("app").innerHTML = `
    <div class="character-detail">

      <div class="character-detail-content">
        <img src="${c.image_url}" alt="${c.name}">

        <h1>${c.name}</h1>
        <h2 class="${factionClass}">${c.faction} ${c.type}</h2>

        <h4>Summary</h4>
        <div class="rich-text">${c.summary}</div>

        <h4>Ability</h4>
        <div class="rich-text">${c.ability}</div>
      </div>

      <div class="detail-actions">
        <button onclick="enterPlayerGame('${lobbyId}')" class="bottom-action-btn">
          Back
        </button>
      </div>

    </div>
  `;
}

async function renderMyRole() {
  const playerId = localStorage.getItem("playerId");
  const lobbyId = localStorage.getItem("activeLobby");

  const { data: player, error } = await client
    .from("players")
    .select("*, characters(*)")
    .eq("id", playerId)
    .single();

  if (error || !player) {
    alert("Failed to load role.");
    console.error(error);
    return;
  }

  const c = player.characters;

  // Use the same character detail layout as admin
  openMyRoleDetail(c, lobbyId);
}

function renderPlayerCardForPlayer(p, idx, me) {
  const canSee = canSeeRole(me, p);
  const factionClass = canSee ? getFactionClass(p) : "";
  const roleBracket = canSee ? ` (${p.characters.name})` : "";

  return `
    <div class="game-card ${!p.is_active || !p.is_alive ? "inactive-player" : ""}">
      
      <div class="player-row ${factionClass}">
        <div class="player-info">
          <b>${p.username}${roleBracket}</b>
        </div>

        ${!p.is_active || !p.is_alive ? `
          <div class="player-icon">
            <img src="${SKULL_URL}" class="skull-icon">
          </div>
        ` : ""}
      </div>

    </div>
  `;
}

function renderPlayerNightCardForPlayer(player, roleIndex, me, myRole, lobby, roleName, players, nightActions) {
  const isMe = player.id === me.id;
  const isTargetInactive = !player.is_active || !player.is_alive;
  const isMeInactive = !me.is_active || !me.is_alive;

  const cardClass = isTargetInactive ? "game-card inactive-player" : "game-card";

  const canSee = canSeeRole(me, player);
  const factionClass = canSee ? getFactionClass(player) : "";
  const roleBracket = canSee ? ` (${player.characters.name})` : "";

  const visitsAllowed = canVisit(roleName);
  const canAct = visitsAllowed > 0 && !isMeInactive;

  // Roles that CAN target inactive players
  const canTargetInactiveRoles = ["Retributionist", "Necromancer"];
  const allowInactiveTarget = canTargetInactiveRoles.includes(roleName);

  // Cultist: cannot act before Night 2
  if (roleName === "Cultist" && lobby.night_number < 2) {
    return `
      <div class="${cardClass}">
        <div class="player-row ${factionClass}">
          <div class="player-info">
            <b>${player.username}${roleBracket}</b>
          </div>
          ${isTargetInactive ? `
            <div class="player-icon">
              <img src="${SKULL_URL}" class="skull-icon">
            </div>
          ` : ""}
        </div>
      </div>
    `;
  }

  // Cultist: loses ability after first visit
  const myActionsAll = nightActions.filter(a => a.player_id === me.id);
  if (roleName === "Cultist" && me.cultist_used) {
    return `
      <div class="${cardClass}">
        <div class="player-row ${factionClass}">
          <div class="player-info">
            <b>${player.username}${roleBracket}</b>
          </div>
          ${isTargetInactive ? `
            <div class="player-icon">
              <img src="${SKULL_URL}" class="skull-icon">
            </div>
          ` : ""}
        </div>
      </div>
    `;
  }

  // Mayor & Prosecutor: hide button after reveal
  if ((roleName === "Mayor" || roleName === "Prosecutor") && me.is_revealed) {
    return `
      <div class="${cardClass}">
        <div class="player-row ${factionClass}">
          <div class="player-info">
            <b>${player.username}${roleBracket}</b>
          </div>
          ${isTargetInactive ? `
            <div class="player-icon">
              <img src="${SKULL_URL}" class="skull-icon">
            </div>
          ` : ""}
        </div>
      </div>
    `;
  }

  // Final allowed check
  const allowedOnThisTarget =
    canAct &&
    (allowInactiveTarget || !isTargetInactive) &&
    roleRestrictions(roleName, lobby.night_number, player, me, players, nightActions);

  return `
    <div class="${cardClass}">

      <div class="player-row ${factionClass}">
        <div class="player-info">
          <b>${player.username}${roleBracket}</b>
        </div>

        ${isTargetInactive ? `
          <div class="player-icon">
            <img src="${SKULL_URL}" class="skull-icon">
          </div>
        ` : ""}
      </div>

      ${allowedOnThisTarget ? `
        <button
          class="bottom-action-btn night-select-btn"
          data-target="${player.id}"
          data-self="${isMe ? "1" : "0"}"
          onclick="selectNightTarget('${player.id}')"
          style="margin-top:8px; width:100%;"
        >
          ${isMe ? "Self" : "Visit"}
        </button>
      ` : ""}

    </div>
  `;
}

function highlightNightSelectionWithActions(actions) {
  // Clear all highlights and reset labels
  document.querySelectorAll(".night-select-btn").forEach(btn => {
    btn.classList.remove("selected-visit-1", "selected-visit-2");

    const isSelf = btn.dataset.self === "1";
    btn.textContent = isSelf ? "Self" : "Visit";
  });

  // Apply highlights and "Selected" label
  actions.forEach(a => {
    const btn = document.querySelector(`.night-select-btn[data-target="${a.target_player_id}"]`);
    if (!btn) return;

    if (a.visit_index === 0) {
      btn.classList.add("selected-visit-1");
    } else if (a.visit_index === 1) {
      btn.classList.add("selected-visit-2");
    }

    btn.textContent = "Selected";
  });
}

async function renderPlayerNight(lobby, player) {
  // Load all players
  const { data: players, error } = await client
    .from("players")
    .select("id, username, is_revealed, is_active, is_alive, cultist_used, character_id, characters(*)")
    .eq("lobby_id", lobby.id)
    .order("username", { ascending: true });

  if (error || !players) {
    console.error("Failed to load players for night:", error);
    alert("Failed to load night phase.");
    return;
  }

  const me = players.find(p => p.id === player.id);

  if (!me || !me.characters) {
    console.error("Could not resolve current player's role for night:", { me });
    alert("Could not load your role for this night.");
    return;
  }

  const myRole = me.characters;
  const roleName = myRole.name;

  // FIX: Load ALL actions for THIS PLAYER across ALL nights
  const { data: nightActions, error: naErr } = await client
    .from("night_actions")
    .select("*")
    .eq("lobby_id", lobby.id)
    .eq("player_id", me.id);   // <-- FIXED: remove night_number filter

  if (naErr || !nightActions) {
    console.error("Failed to load night actions:", naErr);
  }

  // expose for selection logic
  window.nightPlayers = players;
  window.myRoleName = roleName;
  window.mePlayerId = me.id;
  window.currentLobbyId = lobby.id;

  document.getElementById("app").innerHTML = `
    <div class="lobby-screen">
      <div class="character-detail-content">
        <h2>Night ${lobby.night_number}</h2>
        <div id="night-timer" style="font-weight:bold;margin-bottom:10px;">
          Night in progress...
        </div>

        <div class="games-list">
          ${players.map((p, idx) =>
            renderPlayerNightCardForPlayer(
              p,
              idx + 1,
              me,
              myRole,
              lobby,
              roleName,
              players,
              nightActions   // <-- now contains ALL actions
            )
          ).join("")}
        </div>
      </div>

      <div class="detail-actions">
        <button class="bottom-action-btn" onclick="renderMyRole()">My Role</button>
        <button class="bottom-action-btn" style="background:#ef4444;" onclick="leaveGame()">Leave</button>
      </div>
    </div>
  `;

  // highlight only THIS NIGHT's actions
  const myActionsThisNight = (nightActions || []).filter(a =>
    a.player_id === me.id && a.night_number === lobby.night_number
  );
  highlightNightSelectionWithActions(myActionsThisNight);

  pollPhaseChange(lobby.id, lobby.phase);
}

async function selectNightTarget(targetId) {
  const lobbyId = window.currentLobbyId || localStorage.getItem("activeLobby");
  const playerId = localStorage.getItem("playerId");
  const roleName = window.myRoleName;
  const players = window.nightPlayers || [];

  if (!lobbyId || !playerId) {
    console.error("Missing lobbyId or playerId in localStorage");
    return;
  }

  const { data: lobby, error: lobbyErr } = await client
    .from("lobbies")
    .select("night_number")
    .eq("id", lobbyId)
    .single();

  if (lobbyErr || !lobby) {
    console.error("Failed to load lobby for night action:", lobbyErr);
    return;
  }

  const nightNumber = lobby.night_number;

  const { data: existing, error: exErr } = await client
    .from("night_actions")
    .select("*")
    .eq("lobby_id", lobbyId)
    .eq("player_id", playerId)
    .eq("night_number", nightNumber)
    .order("visit_index", { ascending: true });

  if (exErr) {
    console.error("Failed to load existing night actions:", exErr);
    return;
  }

  const me = players.find(p => p.id === playerId);
  const target = players.find(p => p.id === targetId);
  if (!me || !target) {
    console.error("Could not resolve me/target in selectNightTarget");
    return;
  }

  // Unified restriction check
  const allowed = roleRestrictions(
    roleName,
    nightNumber,
    target,
    me,
    players,
    existing
  );
  
  if (!allowed) return;

  const existingForTarget = existing.find(a => a.target_player_id === targetId);

  // Deselect if already selected
  if (existingForTarget) {
    const { error: delErr } = await client
      .from("night_actions")
      .delete()
      .eq("id", existingForTarget.id);

    if (delErr) {
      console.error("Failed to delete night action:", delErr);
    }

    const { data: updated, error: updErr } = await client
      .from("night_actions")
      .select("*")
      .eq("lobby_id", lobbyId)
      .eq("player_id", playerId)
      .eq("night_number", nightNumber)
      .order("visit_index", { ascending: true });

    if (!updErr) highlightNightSelectionWithActions(updated || []);
    return;
  }

  const visitsAllowed = canVisit(roleName);
  const currentCount = existing.length;

  if (currentCount >= visitsAllowed) {
    // Replace second visit if two already selected
    const second = existing.find(a => a.visit_index === 1) || existing[existing.length - 1];

    if (second) {
      const { error: delErr2 } = await client
        .from("night_actions")
        .delete()
        .eq("id", second.id);

      if (delErr2) {
        console.error("Failed to delete second visit:", delErr2);
        return;
      }
    }
  }

  let visitIndex = 0;
  const remaining = (await client
    .from("night_actions")
    .select("*")
    .eq("lobby_id", lobbyId)
    .eq("player_id", playerId)
    .eq("night_number", nightNumber)
    .order("visit_index", { ascending: true })).data || [];

  if (remaining.length === 1) visitIndex = 1;

  const firstVisit = remaining.find(a => a.visit_index === 0);
  const getFaction = p => p.characters?.faction;
  const targetFaction = getFaction(target);
  const myFaction = getFaction(me);

  const { error: insErr } = await client
    .from("night_actions")
    .insert([{
      lobby_id: lobbyId,
      player_id: playerId,
      night_number: nightNumber,
      target_player_id: targetId,
      visit_index: visitIndex
    }]);

  if (insErr) {
    console.error("Failed to insert night action:", insErr);
    return;
  }

  const { data: finalActions, error: finalErr } = await client
    .from("night_actions")
    .select("*")
    .eq("lobby_id", lobbyId)
    .eq("player_id", playerId)
    .eq("night_number", nightNumber)
    .order("visit_index", { ascending: true });

  if (!finalErr) {
  window.nightActions = finalActions;   // <-- FIX
  highlightNightSelectionWithActions(finalActions || []);
  }
}

function canVisit(roleName) {
  return {
    "Transporter": 2,
    "Disguiser": 2,
    "Witch": 2,
    "Seer": 2,
    "Necromancer": 2,
    "Veteran": 1,
    "Doctor": 1,
    "Trapper": 1,
    "Arsonist": 1,
    "Werewolf": 1,
    "Serial Killer": 1,
    "Retributionist": 1
  }[roleName] || 1;
}

function roleRestrictions(roleName, nightNumber, target, me, players, nightActions) {
  const getFaction = p => p.characters?.faction;
  const myFaction = getFaction(me);
  const targetFaction = getFaction(target);

  const myActionsAll = nightActions.filter(a => a.player_id === me.id);
  const firstVisit = myActionsAll.find(a => a.visit_index === 0);

  // Roles that cannot act at all
  const noVisit = ["Covenite", "Spy", "Executioner", "Jester"];
  if (noVisit.includes(roleName)) return false;

  // --- SPECIAL ROLES FIRST ---

  // Serial Killer
  if (roleName === "Serial Killer") {
    if (nightNumber === 1) return false;
    if (target.id === me.id) return false;
    return true;
  }

  // Werewolf
  if (roleName === "Werewolf") {
    if (target.id === me.id && nightNumber % 2 === 1) return false;
    return true;
  }

  // Veteran
  if (roleName === "Veteran") {
    if (target.id !== me.id) return false;
    const selfUses = myActionsAll.filter(a => a.target_player_id === me.id).length;
    if (selfUses >= 2) return false;
    return true;
  }

  // Doctor
  if (roleName === "Doctor") {
    if (target.is_revealed) return false;
    if (target.id === me.id) {
      const selfUses = myActionsAll.filter(a => a.target_player_id === me.id).length;
      if (selfUses >= 1) return false;
    }
    return true;
  }

  // Trapper
  if (roleName === "Trapper") {
    if (target.is_revealed) return false;
    return true;
  }

  // Bodyguard
  if (roleName === "Bodyguard") {
    if (target.is_revealed) return false;
    return true;
  }

  // Vigilante
  if (roleName === "Vigilante") {
    if (myActionsAll.length >= 1) return false;
    return true;
  }

  // Retributionist
  if (roleName === "Retributionist") {
    if (target.is_alive) return false;
    if (myActionsAll.length >= 1) return false;
    return true;
  }

  // Cultist
  if (roleName === "Cultist") {
    if (nightNumber < 2) return false;
    if (!target.is_alive) return false;
    if (targetFaction === "Coven") return false;
    if (target.id === me.id) return false;
    if (me.cultist_used) return false;
    return true;
  }

  // Mayor & Prosecutor
  if (roleName === "Mayor" || roleName === "Prosecutor") {
    if (nightNumber === 1) return false;
    if (target.id !== me.id) return false;

    const selfUses = myActionsAll.filter(a => a.target_player_id === me.id).length;
    if (selfUses >= 1) return false;

    if (me.is_revealed) return false;

    return true;
  }

  // Seer (merged logic)
  if (roleName === "Seer") {
    if (target.id === me.id) return false;
    if (target.is_revealed) return false;
    if (target.characters?.role === "Jailor") return false;
    if (firstVisit && firstVisit.target_player_id === target.id) return false;
    return true;
  }

  // Witch (merged logic)
  if (roleName === "Witch") {
    if (target.id === me.id) return false;

    if (!firstVisit) {
      if (targetFaction === "Coven") return false;
    } else {
      if (firstVisit.target_player_id === target.id) return false;
    }
    return true;
  }

  // Transporter (merged logic)
  if (roleName === "Transporter") {
    if (firstVisit && firstVisit.target_player_id === target.id) return false;
    return true;
  }

  // Disguiser (merged logic)
  if (roleName === "Disguiser") {
    if (!firstVisit && targetFaction !== "Mafia") return false;
    if (firstVisit && targetFaction === "Mafia") return false;
    if (firstVisit && firstVisit.target_player_id === target.id) return false;
    return true;
  }

  // Necromancer (merged logic)
  if (roleName === "Necromancer") {
    if (!firstVisit) {
      if (target.is_alive) return false;
    } else {
      if (!target.is_alive) return false;
      if (firstVisit.target_player_id === target.id) return false;
    }
    return true;
  }

  // Mafia roles
  const mafiaRoles = ["Godfather", "Mafioso", "Framer", "Bootlegger", "Consigliere", "Hypnotist"];
  if (mafiaRoles.includes(roleName)) {
    if (targetFaction === "Mafia") return false;
  }

  // Coven killers/support
  const covenNonCovenRoles = ["Hex Master", "Ritualist", "Potion Master", "Poisoner", "Dreamweaver", "Cultist"];
  if (covenNonCovenRoles.includes(roleName)) {
    if (targetFaction === "Coven") return false;
  }

  // Illusionist
  if (roleName === "Illusionist") {
    if (targetFaction !== "Coven") return false;
  }

  // Arsonist
  if (roleName === "Arsonist") return true;

  // Default self-target rule
  if (target.id === me.id) {
    const allowedSelf = ["Transporter", "Arsonist"];
    if (!allowedSelf.includes(roleName)) return false;
  }

  return true;
}

async function resolveCultistConversion(lobbyId, nightNumber) {
  const { data: actions, error } = await client
    .from("night_actions")
    .select(`
      id,
      player_id,
      target_player_id,
      actor:player_id (
        id,
        username,
        characters:character_id (*)
      ),
      target:target_player_id (
        id,
        username,
        characters:character_id (*)
      )
    `)
    .eq("lobby_id", lobbyId)
    .eq("night_number", nightNumber);

  if (error) {
    console.error("Cultist resolver query failed:", error);
    return;
  }

  if (!actions) return;

  const cultistActions = actions.filter(a => a.actor.characters.name === "Cultist");

  for (const action of cultistActions) {
    const target = action.target;

    // Cannot convert non-Town OR protected Town roles
    const blockedTownRoles = ["Jailor", "Mayor", "Prosecutor"];

    if (
      target.characters.faction !== "Town" ||
      blockedTownRoles.includes(target.characters.name)
    ) {
      // Failed conversion → ability NOT consumed
      continue;
    }

    await client
      .from("players")
      .update({ character_id: '353151e2-a995-453f-b462-ca7df49f9486' })
      .eq("id", target.id);

    await client
      .from("players")
      .update({ cultist_used: true })
      .eq("id", action.player_id);
  }
}

async function resolveMayorProsecutorReveal(lobbyId, nightNumber) {
  const { data: actions, error } = await client
    .from("night_actions")
    .select(`
      id,
      player_id,
      target_player_id,
      actor:player_id (
        id,
        username,
        characters:character_id (*)
      )
    `)
    .eq("lobby_id", lobbyId)
    .eq("night_number", nightNumber);

  if (error) {
    console.error("Reveal resolver failed:", error);
    return;
  }


  if (!actions) return;

  for (const action of actions) {
    const actor = action.actor;
    if (!actor) continue;

    const role = actor.characters.name;
    
    if (role !== "Mayor" && role !== "Prosecutor") continue;

    if (action.player_id !== action.target_player_id) continue;

    await client
      .from("players")
      .update({ is_revealed: true })
      .eq("id", action.player_id);
  }
}

async function leaveGame() {
  const ok = confirm("Leave the game?");
  if (!ok) return;

  const playerId = localStorage.getItem("playerId");

  await client
    .from("players")
    .update({ is_active: false })
    .eq("id", playerId);

  localStorage.removeItem("activeLobby");
  localStorage.removeItem("playerId");

  loadCharacterHome();
}

// Auto-login if username already stored
window.addEventListener("load", () => {
  const username = localStorage.getItem("username");
  const role = localStorage.getItem("role");

  if (username && role) {
    loadCharacterHome();
  }

});














