const ADMIN_FIREBASE_APP_URL = "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
const ADMIN_FIREBASE_AUTH_URL = "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
const ADMIN_FIREBASE_DB_URL = "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
const ADMIN_FIREBASE_STORAGE_URL = "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

const adminState = {
  auth: null,
  db: null,
  storage: null,
  services: null,
  products: []
};

function adminConfig() {
  return window.LYKA_FIREBASE_CONFIG || { enabled: false };
}

function parseCommaList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function adminStatus(node, message, state = "default") {
  if (!node) {
    return;
  }

  node.hidden = false;
  node.dataset.state = state;
  node.textContent = message;
}

async function initializeAdminFirebase() {
  const config = adminConfig();
  if (!config.enabled || !config.projectId) {
    throw new Error("Firebase is not configured yet.");
  }

  const [{ initializeApp }, authModule, firestoreModule, storageModule] = await Promise.all([
    import(ADMIN_FIREBASE_APP_URL),
    import(ADMIN_FIREBASE_AUTH_URL),
    import(ADMIN_FIREBASE_DB_URL),
    import(ADMIN_FIREBASE_STORAGE_URL)
  ]);

  const app = initializeApp(config);
  adminState.auth = authModule.getAuth(app);
  adminState.db = firestoreModule.getFirestore(app);
  adminState.storage = storageModule.getStorage(app);
  adminState.services = { authModule, firestoreModule, storageModule };
}

function redirectTo(path) {
  window.location.href = path;
}

function renderAdminProducts() {
  const list = document.querySelector("[data-admin-product-list]");
  if (!list) {
    return;
  }

  if (!adminState.products.length) {
    list.innerHTML = `<p class="empty-state">No products found yet. Add your first product using the form.</p>`;
    return;
  }

  list.innerHTML = adminState.products.map((product) => `
    <article class="admin-card">
      <div class="admin-card__row">
        <img class="admin-card__thumb" src="${product.cover}" alt="${product.name}">
        <div>
          <h3>${product.name}</h3>
          <p>${product.category} • INR ${product.price}</p>
        </div>
      </div>
      <p>${product.description}</p>
      <div class="admin-card__actions">
        <button class="button-secondary" type="button" data-edit-product="${product.id}">Edit</button>
        <button class="button" type="button" data-delete-product="${product.id}">Delete</button>
      </div>
    </article>
  `).join("");
}

function fillProductForm(product) {
  const form = document.querySelector("[data-product-form]");
  const preview = document.querySelector("[data-image-preview]");
  if (!form) {
    return;
  }

  form.elements.id.value = product.id;
  form.elements.name.value = product.name;
  form.elements.category.value = product.category;
  form.elements.price.value = product.price;
  form.elements.badge.value = product.badge || "";
  form.elements.description.value = product.description || "";
  form.elements.details.value = product.details || "";
  form.elements.keywords.value = (product.keywords || []).join(", ");
  form.elements.materials.value = (product.materials || []).join(", ");
  form.elements.imageUrls.value = (product.gallery || []).map((image) => image.src).join(", ");

  if (preview) {
    preview.innerHTML = (product.gallery || []).map((image) => `<img src="${image.src}" alt="${product.name} preview">`).join("");
  }
}

function resetProductForm() {
  const form = document.querySelector("[data-product-form]");
  const preview = document.querySelector("[data-image-preview]");
  const status = document.querySelector("[data-product-status]");
  if (form) {
    form.reset();
    form.elements.id.value = "";
  }
  if (preview) {
    preview.innerHTML = "";
  }
  if (status) {
    status.hidden = true;
  }
}

async function uploadImages(files) {
  const uploads = [];
  const { ref, uploadBytes, getDownloadURL } = adminState.services.storageModule;

  for (const file of files) {
    const imageRef = ref(adminState.storage, `products/${Date.now()}-${file.name}`);
    await uploadBytes(imageRef, file);
    const url = await getDownloadURL(imageRef);
    uploads.push(url);
  }

  return uploads;
}

async function saveProduct(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.querySelector("[data-product-status]");

  if (!form.reportValidity()) {
    adminStatus(status, "Please complete all required product fields.");
    return;
  }

  const docId = form.elements.id.value.trim();
  const fileList = Array.from(form.elements.images.files || []);
  const pastedUrls = parseCommaList(form.elements.imageUrls.value);
  let uploadedUrls = [];

  try {
    adminStatus(status, "Saving product...");
    if (fileList.length) {
      uploadedUrls = await uploadImages(fileList);
    }

    const galleryUrls = [...uploadedUrls, ...pastedUrls];
    const productRecord = {
      id: docId || String(form.elements.name.value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      name: form.elements.name.value.trim(),
      category: form.elements.category.value,
      price: Number(form.elements.price.value),
      badge: form.elements.badge.value.trim(),
      description: form.elements.description.value.trim(),
      details: form.elements.details.value.trim(),
      keywords: parseCommaList(form.elements.keywords.value),
      materials: parseCommaList(form.elements.materials.value),
      cover: galleryUrls[0] || "images/logo.png",
      gallery: galleryUrls.map((url, index) => ({
        src: url,
        alt: `${form.elements.name.value.trim()} image ${index + 1}`
      })),
      updatedAt: new Date().toISOString()
    };

    const { doc, setDoc } = adminState.services.firestoreModule;
    await setDoc(doc(adminState.db, "products", productRecord.id), productRecord);
    adminStatus(status, "Product saved successfully. The storefront will update automatically.", "success");
    resetProductForm();
  } catch (error) {
    adminStatus(status, error.message || "Could not save the product.");
  }
}

function previewSelectedImages(files) {
  const preview = document.querySelector("[data-image-preview]");
  if (!preview) {
    return;
  }

  preview.innerHTML = "";
  Array.from(files).forEach((file) => {
    const image = document.createElement("img");
    image.src = URL.createObjectURL(file);
    image.alt = "Selected product preview";
    preview.appendChild(image);
  });
}

function setupDashboardEvents() {
  const form = document.querySelector("[data-product-form]");
  if (!form) {
    return;
  }

  form.addEventListener("submit", saveProduct);
  form.elements.images.addEventListener("change", (event) => {
    previewSelectedImages(event.target.files);
  });

  document.querySelector("[data-reset-form]")?.addEventListener("click", resetProductForm);
  document.querySelector("[data-admin-logout]")?.addEventListener("click", async () => {
    await adminState.services.authModule.signOut(adminState.auth);
    redirectTo("admin-login.html");
  });

  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const editButton = target.closest("[data-edit-product]");
    if (editButton) {
      const product = adminState.products.find((item) => item.id === editButton.dataset.editProduct);
      if (product) {
        fillProductForm(product);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }

    const deleteButton = target.closest("[data-delete-product]");
    if (deleteButton) {
      const shouldDelete = window.confirm("Delete this product from the live catalog?");
      if (!shouldDelete) {
        return;
      }

      const { deleteDoc, doc } = adminState.services.firestoreModule;
      await deleteDoc(doc(adminState.db, "products", deleteButton.dataset.deleteProduct));
    }
  });
}

function watchProducts() {
  const { collection, onSnapshot } = adminState.services.firestoreModule;
  onSnapshot(collection(adminState.db, "products"), (snapshot) => {
    adminState.products = snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
    renderAdminProducts();
  });
}

function initAdminLogin() {
  const form = document.querySelector("[data-admin-login]");
  const status = document.querySelector("[data-admin-login-status]");
  if (!form) return;

  adminState.services.authModule.onAuthStateChanged(adminState.auth, (user) => {
    if (user) {
      redirectTo("admin.html");
    }
  });

  // Handle standard Email form submission
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.elements.email.value || !form.elements.password.value) {
      adminStatus(status, "Enter a valid username/email and password.");
      return;
    }
    try {
      adminStatus(status, "Signing in...");
      await adminState.services.authModule.signInWithEmailAndPassword(
        adminState.auth,
        form.elements.email.value.trim(),
        form.elements.password.value
      );
      redirectTo("admin.html");
    } catch (error) {
      adminStatus(status, "Login failed. Check your credentials.");
    }
  });

  // Google Login
  const googleBtn = form.querySelector("[data-google-login]");
  if (googleBtn) {
    googleBtn.addEventListener("click", async () => {
      try {
        adminStatus(status, "Waiting for Google to sign in...");
        const provider = new adminState.services.authModule.GoogleAuthProvider();
        await adminState.services.authModule.signInWithPopup(adminState.auth, provider);
        // Will auto redirect due to onAuthStateChanged
      } catch (error) {
        adminStatus(status, "Google sign in was cancelled or failed.");
      }
    });
  }

  // Phone Login Flow
  const phoneToggleBtn = form.querySelector("[data-phone-toggle]");
  const emailSection = form.querySelector("#email-section");
  const phoneSection = form.querySelector("#phone-section");
  const sendOtpBtn = form.querySelector("[data-send-otp]");
  const verifyOtpBtn = form.querySelector("[data-verify-otp]");
  const otpSection = form.querySelector("[data-otp-section]");

  if (phoneToggleBtn && phoneSection) {
    phoneToggleBtn.addEventListener("click", () => {
      const isPhoneVisible = !phoneSection.hidden;
      phoneSection.hidden = isPhoneVisible;
      emailSection.hidden = !isPhoneVisible;
      phoneToggleBtn.textContent = isPhoneVisible ? "Switch to Phone Auth" : "Switch to Email Auth";
    });

    // Setup reCAPTCHA config globally on window so Firebase can find it
    window.recaptchaVerifier = new adminState.services.authModule.RecaptchaVerifier(adminState.auth, 'recaptcha-container', {
      'size': 'invisible'
    });

    sendOtpBtn.addEventListener("click", async () => {
      const phoneInput = form.elements.phone;
      if (!phoneInput.value) {
         adminStatus(status, "Please enter a valid phone number.");
         return;
      }
      try {
        adminStatus(status, "Sending SMS code...");
        window.confirmationResult = await adminState.services.authModule.signInWithPhoneNumber(
          adminState.auth, 
          phoneInput.value.trim(), 
          window.recaptchaVerifier
        );
        otpSection.hidden = false;
        sendOtpBtn.hidden = true;
        adminStatus(status, "SMS Sent! Enter the code below.", "success");
      } catch (error) {
        adminStatus(status, "Failed to send SMS. Ensure your domain is authorized in Firebase.");
      }
    });

    verifyOtpBtn.addEventListener("click", async () => {
      const otpInput = form.elements.otp;
      if (!otpInput.value) return;
      try {
        adminStatus(status, "Verifying code...");
        await window.confirmationResult.confirm(otpInput.value.trim());
        // Will auto redirect due to onAuthStateChanged
      } catch (error) {
        adminStatus(status, "Invalid verification code.");
      }
    });
  }
}

function initAdminDashboard() {
  const status = document.querySelector("[data-product-status]");
  adminState.services.authModule.onAuthStateChanged(adminState.auth, (user) => {
    if (!user) {
      redirectTo("admin-login.html");
      return;
    }

    adminStatus(status, "Connected. Product updates will sync live.", "success");
    setupDashboardEvents();
    watchProducts();
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initializeAdminFirebase();
  } catch (error) {
    const status = document.querySelector("[data-admin-login-status]") || document.querySelector("[data-product-status]");
    adminStatus(status, "Add your Firebase project credentials in firebase-config.js before using the admin panel.");
    return;
  }

  if (document.querySelector("[data-admin-login]")) {
    initAdminLogin();
  }

  if (document.querySelector("[data-product-form]")) {
    initAdminDashboard();
  }
});
