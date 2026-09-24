(() => {
  'use strict';
  const API_URL = 'https://api.psicologopj.com.br';
  const menuButton = document.querySelector('.menu-toggle');
  const mobileNav = document.getElementById('mobile-nav');
  const setMenu = (open) => {
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    mobileNav.hidden = !open;
  };
  menuButton.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
  mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') setMenu(false); });
  matchMedia('(min-width: 781px)').addEventListener('change', event => { if (event.matches) setMenu(false); });

  const dialog = document.getElementById('contact-dialog');
  const form = document.getElementById('contact-form');
  const formView = document.getElementById('contact-form-view');
  const success = document.getElementById('contact-success');
  const nameInput = document.getElementById('contact-name');
  const emailInput = document.getElementById('contact-email');
  const phoneInput = document.getElementById('contact-phone');
  const consent = document.getElementById('contact-consent');
  const formError = document.getElementById('form-error');
  const submitButton = form.querySelector('[type="submit"]');
  const closeButton = dialog.querySelector('.dialog-close');
  const intents = { abrir: 'a abertura do seu CNPJ', migrar: 'a transferência da sua contabilidade', conversar: 'as suas dúvidas sobre o plano' };
  let previousFocus;
  let sending = false;

  function clearErrors() {
    formError.hidden = true;
    form.querySelectorAll('.field-error').forEach(error => { error.hidden = true; });
    form.querySelectorAll('[aria-invalid]').forEach(input => input.removeAttribute('aria-invalid'));
  }
  function openContact(intent) {
    if (!Object.hasOwn(intents, intent) || dialog.open) return;
    previousFocus = document.activeElement;
    setMenu(false);
    form.reset();
    clearErrors();
    formView.hidden = false;
    success.hidden = true;
    dialog.setAttribute('aria-labelledby', 'contact-title');
    dialog.setAttribute('aria-describedby', 'contact-description');
    form.querySelector(`input[name="objetivo"][value="${intent}"]`).checked = true;
    dialog.showModal();
    document.body.classList.add('modal-open');
    nameInput.focus();
  }
  document.querySelectorAll('[data-contact]').forEach(button => button.addEventListener('click', () => openContact(button.dataset.contact)));
  const closeContact = () => { if (!sending) dialog.close(); };
  closeButton.addEventListener('click', closeContact);
  document.getElementById('finish-contact').addEventListener('click', closeContact);
  dialog.addEventListener('cancel', event => { if (sending) event.preventDefault(); });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeContact();
  });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const targets = [...dialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), textarea')].filter(el => el.getClientRects().length);
    const first = targets[0], last = targets[targets.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  dialog.addEventListener('close', () => {
    form.reset();
    clearErrors();
    document.body.classList.remove('modal-open');
    previousFocus?.focus();
  });
  [nameInput, emailInput, phoneInput, consent].forEach(input => input.addEventListener('input', () => {
    input.removeAttribute('aria-invalid');
    document.getElementById(input.getAttribute('aria-describedby')).hidden = true;
    formError.hidden = true;
  }));

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending) return;
    clearErrors();
    const invalid = [];
    if (nameInput.value.trim().length < 2) invalid.push([nameInput, 'name-error']);
    if (!emailInput.value.trim() || !emailInput.validity.valid) invalid.push([emailInput, 'email-error']);
    const digits = phoneInput.value.replace(/\D/g, '');
    if (!/^[1-9]{2}\d{8,9}$/.test(digits)) invalid.push([phoneInput, 'phone-error']);
    if (!consent.checked) invalid.push([consent, 'consent-error']);
    if (invalid.length) {
      invalid.forEach(([input, errorId]) => { input.setAttribute('aria-invalid', 'true'); document.getElementById(errorId).hidden = false; });
      formError.textContent = 'Confira os campos indicados para enviar sua solicitação.';
      formError.hidden = false;
      invalid[0][0].focus();
      return;
    }
    const selected = form.querySelector('input[name="objetivo"]:checked');
    if (!selected || !Object.hasOwn(intents, selected.value)) {
      formError.textContent = 'Escolha como podemos ajudar.';
      formError.hidden = false;
      form.querySelector('input[name="objetivo"]').focus();
      return;
    }
    const intent = selected.value;
    const payload = {
      nome: nameInput.value.trim(), email: emailInput.value.trim(), telefone: digits,
      plano_interesse: 'clinica', ja_tem_cnpj: intent === 'migrar', aceite_lgpd: consent.checked,
      mensagem: `Interesse: Plano Psicólogo PJ — R$ 199/mês. Objetivo: ${intents[intent]}.\n${form.elements.mensagem.value.trim()}`,
      website: form.elements.website.value,
    };
    sending = true;
    submitButton.disabled = true;
    closeButton.disabled = true;
    submitButton.textContent = 'Enviando…';
    form.setAttribute('aria-busy', 'true');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`${API_URL}/api/leads/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
      if (!response.ok) {
        const details = await response.json().catch(() => ({}));
        const fields = { nome: [nameInput, 'name-error'], email: [emailInput, 'email-error'], telefone: [phoneInput, 'phone-error'], aceite_lgpd: [consent, 'consent-error'] };
        for (const [key, [input, id]] of Object.entries(fields)) {
          if (details[key]) { input.setAttribute('aria-invalid', 'true'); document.getElementById(id).hidden = false; }
        }
        throw new Error(response.status === 429 ? 'Muitas tentativas em pouco tempo. Aguarde alguns minutos ou fale conosco pelo WhatsApp.' : 'Não foi possível enviar. Confira os dados ou fale conosco pelo WhatsApp.');
      }
      document.getElementById('success-intent').textContent = intents[intent];
      form.reset();
      formView.hidden = true;
      success.hidden = false;
      success.querySelector('h2').id = 'success-title';
      dialog.setAttribute('aria-labelledby', 'success-title');
      dialog.removeAttribute('aria-describedby');
      success.focus();
      dialog.scrollTop = 0;
    } catch (error) {
      formError.textContent = error.name === 'AbortError' || error instanceof TypeError
        ? 'Não foi possível confirmar o envio. Confira com a equipe pelo WhatsApp antes de tentar novamente.'
        : error.message;
      const link = document.createElement('a');
      link.href = 'https://wa.me/5511976427721'; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = ' Abrir WhatsApp ↗';
      formError.append(link);
      formError.hidden = false;
    } finally {
      clearTimeout(timeout);
      sending = false;
      submitButton.disabled = false;
      closeButton.disabled = false;
      submitButton.textContent = 'Enviar solicitação ↗';
      form.removeAttribute('aria-busy');
    }
  });
})();
