const seedPins = [
  ["interiors", "A kitchen made for slow mornings", "photo-1600210492486-724fe5c67fb0"],
  ["style", "The long way home", "photo-1470252649378-9c29740c9fa8"],
  ["details", "A table set for absolutely no reason", "photo-1490750967868-88aa4486c946"],
  ["interiors", "Somewhere between indoors and out", "photo-1600607687939-ce8a6c25118c"],
  ["style", "A little sun on the way to nowhere", "photo-1470770841072-f978cf4d019e"],
  ["details", "Market flowers, still in their paper", "photo-1494972308805-463bc619d34e"],
  ["interiors", "Soft light, softer linen", "photo-1616486338812-3dadae4b4ace"],
  ["style", "Take the afternoon off", "photo-1500534623283-312aade485b7"],
  ["details", "The prettiest peaches at the market", "photo-1568702846914-96b305d2aaeb"],
  ["interiors", "A room that lets you exhale", "photo-1600566753086-00f18fb6b3ea"],
  ["style", "Golden hour, every hour", "photo-1500530855697-b586d89ba3ee"],
  ["details", "Little rituals for a slower life", "photo-1499209974431-9dddcece7f88"],
].map(([category, caption, photo], index) => ({
  id: `seed-${index + 1}`,
  category,
  caption,
  image: `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=800&q=85`,
  createdAt: index + 1,
}));

const CATEGORY_NAMES = { interiors: "Interiors", style: "Slow living", details: "Little details" };
const STORAGE_KEY = "provence-moodboard";
const grid = document.querySelector("#pinsGrid");
const emptyState = document.querySelector("#emptyState");
const dialog = document.querySelector("#pinDialog");
const form = document.querySelector("#pinForm");
const imageInput = document.querySelector("#imageInput");
const uploadArea = document.querySelector("#uploadArea");
const uploadPreview = document.querySelector("#uploadPreview");
const uploadTitle = document.querySelector("#uploadTitle");
const formError = document.querySelector("#formError");
const toast = document.querySelector("#toast");
const searchInput = document.querySelector("#searchInput");
let currentFilter = "all";
let sortOldest = false;
let imageData = null;
let toastTimer;

function readStorage() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const overrides = new Map((stored.overrides || []).map((pin) => [pin.id, pin]));
    const removed = new Set(stored.removed || []);
    const samples = seedPins.filter((pin) => !removed.has(pin.id)).map((pin) => ({ ...pin, ...overrides.get(pin.id) }));
    return {
      title: typeof stored.title === "string" ? stored.title : "Sunday in Provence",
      pins: [...samples, ...(stored.pins || [])],
      removed,
    };
  } catch (error) {
    console.error("Could not read the saved moodboard:", error);
    return { title: "Sunday in Provence", pins: seedPins, removed: new Set() };
  }
}

const saved = readStorage();
let boardTitle = saved.title;
let pins = saved.pins;
let removedPins = saved.removed;

function persist() {
  const overrides = pins.filter((pin) => pin.id.startsWith("seed-") && pin.caption !== seedPins.find((seed) => seed.id === pin.id)?.caption);
  const userPins = pins.filter((pin) => !pin.id.startsWith("seed-"));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      title: boardTitle,
      pins: userPins,
      overrides,
      removed: [...removedPins],
    }));
    return true;
  } catch (error) {
    console.error("Could not save the moodboard:", error);
    showToast("Couldn't save changes. The image may be too large for browser storage.");
    return false;
  }
}

function updateTitle() {
  document.querySelector("#boardTitle").textContent = boardTitle;
  document.querySelector("#breadcrumbTitle").textContent = boardTitle;
  document.querySelector("#sidebarTitle").textContent = boardTitle;
}

function renderPins() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = pins
    .filter((pin) => currentFilter === "all" || pin.category === currentFilter)
    .filter((pin) => !query || `${pin.caption} ${CATEGORY_NAMES[pin.category]}`.toLowerCase().includes(query))
    .sort((a, b) => sortOldest ? a.createdAt - b.createdAt : b.createdAt - a.createdAt);
  grid.replaceChildren();
  filtered.forEach((pin) => {
    const card = document.createElement("article");
    card.className = "pin-card";
    const wrap = document.createElement("div");
    wrap.className = "pin-image-wrap";
    const image = document.createElement("img");
    image.className = "pin-image";
    image.src = pin.image;
    image.alt = pin.caption || CATEGORY_NAMES[pin.category];
    image.loading = "lazy";
    wrap.append(image);
    const actions = document.createElement("div");
    actions.className = "pin-actions";
    const edit = document.createElement("button");
    edit.className = "pin-action";
    edit.type = "button";
    edit.textContent = "✎";
    edit.setAttribute("aria-label", "Edit caption");
    edit.addEventListener("click", () => editCaption(pin));
    const remove = document.createElement("button");
    remove.className = "pin-action";
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", "Remove pin");
    remove.addEventListener("click", () => removePin(pin.id));
    actions.append(edit, remove);
    wrap.append(actions);
    const caption = document.createElement("p");
    caption.className = "pin-caption";
    caption.textContent = pin.caption || "A little inspiration";
    const category = document.createElement("div");
    category.className = "pin-category";
    category.textContent = CATEGORY_NAMES[pin.category];
    card.append(wrap, caption, category);
    grid.append(card);
  });
  grid.hidden = filtered.length === 0;
  emptyState.hidden = filtered.length !== 0;
  document.querySelector("#pinCount").textContent = `${pins.length} ${pins.length === 1 ? "pin" : "pins"}`;
  document.querySelector("#allCount").textContent = pins.length;
  document.querySelector("#sidebarPinCount").textContent = pins.length;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2400);
}

function openDialog() {
  form.reset();
  imageData = null;
  formError.textContent = "";
  uploadPreview.hidden = true;
  uploadPreview.removeAttribute("src");
  uploadTitle.innerHTML = 'Drop an image here, or <strong>browse</strong>';
  dialog.showModal();
}

function chooseImage(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    formError.textContent = "Please choose an image file.";
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    formError.textContent = "Choose an image smaller than 10 MB.";
    return;
  }
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    imageData = String(reader.result);
    uploadPreview.src = imageData;
    uploadPreview.hidden = false;
    uploadTitle.textContent = file.name;
    formError.textContent = "";
  });
  reader.addEventListener("error", () => {
    formError.textContent = "Couldn't read that image. Please try another.";
  });
  reader.readAsDataURL(file);
}

function removePin(id) {
  const previous = pins;
  pins = pins.filter((pin) => pin.id !== id);
  if (id.startsWith("seed-")) removedPins.add(id);
  if (!persist()) {
    pins = previous;
    if (id.startsWith("seed-")) removedPins.delete(id);
    return;
  }
  renderPins();
  showToast("Pin removed from your board");
}

function editCaption(pin) {
  const caption = window.prompt("Update this pin's caption:", pin.caption || "");
  if (caption === null) return;
  const previous = pin.caption;
  pin.caption = caption.trim();
  if (!persist()) {
    pin.caption = previous;
    return;
  }
  renderPins();
  showToast("Caption updated");
}

document.querySelector("#addPinButton").addEventListener("click", openDialog);
document.querySelector("#emptyAddPinButton").addEventListener("click", openDialog);
document.querySelector("#closeDialogButton").addEventListener("click", () => dialog.close());
imageInput.addEventListener("change", () => chooseImage(imageInput.files[0]));
uploadArea.addEventListener("dragover", (event) => {
  event.preventDefault();
  uploadArea.classList.add("dragging");
});
uploadArea.addEventListener("dragleave", () => uploadArea.classList.remove("dragging"));
uploadArea.addEventListener("drop", (event) => {
  event.preventDefault();
  uploadArea.classList.remove("dragging");
  chooseImage(event.dataTransfer.files[0]);
});
form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!imageData) {
    formError.textContent = "Choose an image to add to your moodboard.";
    return;
  }
  const pin = {
    id: `pin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    category: document.querySelector("#categoryInput").value,
    caption: document.querySelector("#captionInput").value.trim(),
    image: imageData,
    createdAt: Date.now(),
  };
  pins.push(pin);
  if (!persist()) {
    pins.pop();
    return;
  }
  renderPins();
  dialog.close();
  showToast("A little inspiration, saved");
});
document.querySelectorAll(".filter-tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector(".filter-tab.active").classList.remove("active");
    button.classList.add("active");
    currentFilter = button.dataset.filter;
    renderPins();
  });
});
searchInput.addEventListener("input", renderPins);
document.querySelector("#sortButton").addEventListener("click", (event) => {
  sortOldest = !sortOldest;
  event.currentTarget.querySelector("span").textContent = sortOldest ? "Oldest first" : "Recently added";
  renderPins();
});
for (const selector of ["#editTitleButton", "#editTitleButtonMain"]) {
  document.querySelector(selector).addEventListener("click", () => {
    const nextTitle = window.prompt("Name your moodboard:", boardTitle);
    if (!nextTitle?.trim()) return;
    boardTitle = nextTitle.trim();
    updateTitle();
    persist();
  });
}
document.querySelector("#shareButton").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    showToast("Board link copied to clipboard");
  } catch (error) {
    console.error("Could not copy board link:", error);
    showToast("Clipboard access isn't available in this browser");
  }
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchInput.focus();
  }
});

updateTitle();
renderPins();
