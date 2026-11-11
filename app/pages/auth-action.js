/**
 * /auth/action: the page the game's account emails link to (verify an
 * address, reset a password, undo an email change), in the game's look
 * instead of Firebase's. The link rules are in app/auth/email-action.js.
 *
 * Firebase only sends players here once the console's action URL is
 * https://dino.spanion.in/auth/action (Authentication > Templates > any
 * template > Customize action URL; one setting covers every template).
 */
import { loadFirebase } from "../firebase/index";
import { readAction, actionError } from "../auth/email-action";

const $ = (id) => document.getElementById(id);

const DINO = {
  happy: "/assets/sprites/player/right/Idle%20(1).webp",
  sad: "/assets/sprites/player/right/Dead%20(8).webp",
};

/** Text with the email addresses in bold, built without innerHTML. */
const fill = (element, parts) => {
  element.textContent = "";
  for (const part of parts) {
    if (part && typeof part === "object") {
      const bold = document.createElement("b");
      bold.textContent = part.bold;
      element.append(bold);
    } else {
      element.append(String(part));
    }
  }
};

const setLink = (element, link) => {
  element.hidden = !link;
  if (!link) return;
  element.textContent = link.label;
  element.href = link.href;
};

/** One of the page's outcomes: a dino, a title, a line or two and up to two links. */
function show({ mood = "happy", title, text, primary, button, secondary }) {
  $("loading").hidden = true;
  $("resetForm").hidden = true;
  $("result").hidden = false;
  $("resultDino").src = DINO[mood];
  const heading = $("resultTitle");
  heading.textContent = title;
  heading.classList.toggle("bad", mood === "sad");
  fill($("resultText"), [].concat(text));
  setLink($("resultPrimary"), primary);
  setLink($("resultSecondary"), secondary);
  const extra = $("resultButton");
  extra.hidden = !button;
  if (button) {
    extra.disabled = false;
    extra.textContent = button.label;
    extra.onclick = button.onClick;
  }
  document.title = `${title} · Dino's Adventure`;
}

const fail = (message, next = "/") =>
  show({
    mood: "sad",
    title: "That didn't work",
    text: message,
    primary: { label: "Back to the game", href: next },
  });

function askForPassword({ auth, authApi }, { oobCode, next }, email) {
  $("loading").hidden = true;
  const form = $("resetForm");
  const input = $("resetPassword");
  const reveal = $("resetReveal");
  const message = $("resetMessage");
  const save = $("resetSave");
  $("resetEmail").textContent = email;
  // lets a password manager file the new password under the right account
  $("resetUser").value = email;
  form.hidden = false;
  input.focus();

  reveal.onclick = () => {
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    reveal.textContent = showing ? "Show" : "Hide";
    reveal.setAttribute("aria-pressed", String(!showing));
  };

  form.onsubmit = async (event) => {
    event.preventDefault();
    const password = input.value;
    if (password.length < 6) {
      message.textContent = "Use at least 6 characters.";
      input.focus();
      return;
    }
    message.textContent = "";
    save.disabled = true;
    save.textContent = "Saving…";
    try {
      await authApi.confirmPasswordReset(auth, oobCode, password);
      show({
        title: "Password changed",
        text: ["Sign in to ", { bold: email }, " with your new password."],
        primary: { label: "Sign in", href: next },
      });
    } catch (error) {
      save.disabled = false;
      save.textContent = "Save password";
      const code = String((error && error.code) || "");
      // a weak password can be fixed here; a dead link can't
      if (/weak-password/.test(code)) message.textContent = actionError(error);
      else fail(actionError(error), next);
    }
  };
}

async function run(action) {
  const fb = await loadFirebase();
  const { auth, authApi } = fb;
  const { mode, oobCode, next } = action;

  if (mode === "resetPassword") {
    const email = await authApi.verifyPasswordResetCode(auth, oobCode);
    askForPassword(fb, action, email);
    return;
  }

  // checkActionCode first: it names the address, and applying the code uses it up
  const info = await authApi.checkActionCode(auth, oobCode);
  const email = (info && info.data && info.data.email) || "";
  await authApi.applyActionCode(auth, oobCode);

  if (mode === "verifyEmail") {
    // a player signed in on this device sees the change at once
    if (auth.currentUser) await auth.currentUser.reload().catch(() => {});
    show({
      title: "Email verified",
      text: email
        ? [{ bold: email }, " is confirmed. You can create and share worlds now."]
        : "Your email is confirmed. You can create and share worlds now.",
      primary: { label: "Back to the game", href: next },
    });
    return;
  }

  if (mode === "verifyAndChangeEmail") {
    show({
      title: "Email changed",
      text: ["Your account now signs in with ", { bold: email }, "."],
      primary: { label: "Back to the game", href: next },
    });
    return;
  }

  // recoverEmail: the account's email went back to `email`
  show({
    title: "Email restored",
    text: [
      "Your account's email is back to ",
      { bold: email },
      ". If you didn't change it, reset your password too.",
    ],
    button: {
      label: "Reset password",
      async onClick() {
        const button = $("resultButton");
        button.disabled = true;
        try {
          await authApi.sendPasswordResetEmail(auth, email);
          button.hidden = true;
          fill($("resultText"), ["We sent a reset link to ", { bold: email }, "."]);
        } catch (error) {
          button.disabled = false;
          fill($("resultText"), [actionError(error)]);
        }
      },
    },
    secondary: { label: "Back to the game", href: next },
  });
}

const action = readAction(location.search, location.origin);
if (action.error) fail(action.error);
else run(action).catch((error) => fail(actionError(error), action.next));
