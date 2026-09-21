let tutorialStep = 0;

function createTutorialSteps(label, steps) {
  return steps.map((step, index) => ({
    title: step.title || `Étape ${index + 1}`,
    text: step.text,
    image: step.image,
    alt:
      step.alt || `Illustration de l’étape ${index + 1} du tutoriel ${label}`,
  }));
}

const tutorialContent = {
  qr: {
    label: "QR Code",
    steps: createTutorialSteps("QR Code", [
      {
        title: "Ouvrir PRONOTE",
        text: "Connectez-vous à PRONOTE depuis un navigateur, puis ouvrez le menu de votre compte et regardez le haut de page.",
        image: "assets/tutorial/qr-code/header.png",
      },
      {
        title: "Accéder au QR Code",
        text: "Cliquez sur le bouton QR Code pour commencer la génération de votre accès.",
        image: "assets/tutorial/qr-code/qr-btn.png",
      },
      {
        title: "Trouver un code",
        text: "Trouvez un code PIN (vous devrez le saisir plus tard) et inscrivez-le dans le champ de saisie.",
        image: "assets/tutorial/qr-code/verif-null.png",
      },
      {
        title: "Entrer le code PIN (1/2)",
        text: "Tapez votre code PIN.",
        image: "assets/tutorial/qr-code/verif.png",
      },
      {
        title: "Générer le QR Code",
        text: "Cliquez sur le bouton Générer pour créer votre QR Code.",
        image: "assets/tutorial/qr-code/generate.png",
      },
      {
        title: "Vérifier le QR Code",
        text: "Un qr-code devrait appraitre.",
        image: "assets/tutorial/qr-code/qr-code.png",
      },
      {
        title: "Sauvegarder le QR Code",
        text: "Faites un clic-droit et sélectionnez \"enregistrer l'image sous\".",
        image: "assets/tutorial/qr-code/save.png",
      },
      {
        title: "Téléverser le QR Code",
        text: "Retournez sur PronoteXP et sélectionnez l'image enregistrée.",
        image: "assets/tutorial/qr-code/choose.png",
      },
      {
        title: "Entrer le code PIN (2/2)",
        text: "Entrez le code PIN saisit dans pronote.",
        image: "assets/tutorial/qr-code/pin.png",
      },
      {
        title: "Exporter les données",
        text: "Appuyez sur \"Exporter\" et corrigez si nécessaire.",
        image: "assets/tutorial/export.png",
      },
    ]),
  },
  token: {
    label: "Jeton / URL",
    steps: createTutorialSteps("token", [
      {
        title: "Ouvrir PRONOTE",
        text: "Ouvrez votre espace PRONOTE dans un navigateur et connectez-vous.",
        image: "assets/tutorial/token/pronote.png",
      },
      {
        title: "Trouver l’adresse PRONOTE",
        text: "Repérez l’adresse complète de votre espace PRONOTE dans la barre du navigateur.",
        image: "assets/tutorial/token/url.png",
      },
      {
        title: "Copier l’URL",
        text: "Copiez cette URL, puis collez-la dans le champ URL PRONOTE de PronoteXP.",
        image: "assets/tutorial/token/url-input.png",
      },
      {
        title: "Trouver le jeton de connexion",
        text: "Repérez le jeton de session dans la barre d'adresse.",
        image: "assets/tutorial/token/token.png",
      },
      {
        title: "Copier le jeton",
        text: "Copiez le jeton de session (sans ajouter d’espace au début ou à la fin) et collez-le dans le champ Jeton de PronoteXP.",
        image: "assets/tutorial/token/token-inp.png",
      },
      {
        title: "Identifier votre compte",
        text: "Repérez votre identifiant unique (prénom.nom souvent) dans les informations de votre compte PRONOTE utilisé pour se connecter à votre session et collez-le dans le champ Identifiant Unique de PronoteXP.",
        image: "assets/tutorial/token/identif-inp.png",
      },
      {
        title: "Exporter les données",
        text: "Appuyez sur \"Exporter\" et corrigez si nécessaire.",
        image: "assets/tutorial/export.png",
      },
    ]),
  },
  cred: {
    label: "Identifiants",
    steps: createTutorialSteps("identifiants", [
      {
        title: "Choisir votre ENT",
        text: "Sélectionnez l’ENT correspondant à votre établissement dans la liste proposée.",
        image: "assets/tutorial/identifiants/academie.png",
      },
      {
        title: "Renseigner l’URL",
        text: "Copiez l’URL complète de votre espace PRONOTE dans le champ prévu.",
        image: "assets/tutorial/identifiants/url.png",
      },
      {
        title: "Trouver l’identifiant",
        text: "Repérez l’identifiant utilisé pour vous connecter à votre espace PRONOTE.",
        image: "assets/tutorial/identifiants/identifiant.png",
      },
      {
        title: "Saisir l’identifiant",
        text: "Saisissez votre identifiant dans le champ Identifiant, sans espace supplémentaire.",
        image: "assets/tutorial/identifiants/identifiant-inp.png",
      },
      {
        title: "Trouver le mot de passe",
        text: "Repérez le mot de passe associé à votre compte PRONOTE.",
        image: "assets/tutorial/identifiants/mdp.png",
      },
      {
        title: "Saisir le mot de passe",
        text: "Saisissez votre mot de passe dans le champ prévu. Il restera masqué à l’écran.",
        image: "assets/tutorial/identifiants/mdp-inp.png",
      },
      {
        title: "Exporter les données",
        text: "Appuyez sur \"Exporter\" et corrigez si nécessaire.",
        image: "assets/tutorial/export.png",
      },
    ]),
  },
};

function updateTutorialButton() {
  const tutorialButton = document.getElementById("btn-tutorial");
  if (!tutorialButton) return;
  tutorialButton.innerText = `Tutoriel ${tutorialContent[currentTab].label}`;
}

function renderTutorialStep() {
  const tutorial = tutorialContent[currentTab];
  const step = tutorial.steps[tutorialStep];
  const isLastStep = tutorialStep === tutorial.steps.length - 1;

  document.getElementById("tutorial-step-count").innerText =
    `${tutorialStep + 1} / ${tutorial.steps.length}`;
  document.getElementById("tutorial-modal-title").innerText =
    `Tutoriel ${tutorial.label}`;
  document.getElementById("tutorial-step-title").innerText = step.title;
  document.getElementById("tutorial-step-text").innerText = step.text;
  const image = document.getElementById("tutorial-step-image");
  image.src = step.image;
  image.alt = step.alt;
  image.classList.toggle("is-placeholder", !step.image);
  document.getElementById("tutorial-previous").disabled = tutorialStep === 0;
  document.getElementById("tutorial-forward").disabled = isLastStep;
  document.getElementById("tutorial-next").innerText = isLastStep
    ? "Ok"
    : "Suivant";
}

function openTutorialModal() {
  tutorialStep = 0;
  renderTutorialStep();
  const modal = document.getElementById("tutorial-modal");
  modal.classList.remove("is-closing");
  modal.classList.remove("hidden");
  document.getElementById("tutorial-next").focus();
}

function closeTutorialModal() {
  const modal = document.getElementById("tutorial-modal");
  if (modal.classList.contains("hidden")) return;
  modal.classList.add("is-closing");
  window.setTimeout(() => {
    modal.classList.add("hidden");
    modal.classList.remove("is-closing");
  }, 220);
}

function moveTutorialStep(direction) {
  const lastStep = tutorialContent[currentTab].steps.length - 1;
  if (tutorialStep === lastStep && direction > 0) {
    closeTutorialModal();
    return;
  }
  tutorialStep = Math.max(0, Math.min(lastStep, tutorialStep + direction));
  renderTutorialStep();
}

document.addEventListener("keydown", (event) => {
  const tutorialModal = document.getElementById("tutorial-modal");
  if (tutorialModal.classList.contains("hidden")) return;
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    moveTutorialStep(-1);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    moveTutorialStep(1);
  }
});
