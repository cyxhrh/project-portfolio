export function resolveAction(action) {
  if (action === 'open-product') return { type: 'view', view: 'product' };
  if (action === 'researching') return { type: 'notice', message: 'This setup is being thoughtfully developed.' };
  if (action === 'select-renter') return { type: 'plan', title: 'Rental-ready', price: '$25', detail: 'No drilling. Easy to take with you.' };
  if (action === 'select-owner') return { type: 'plan', title: 'Built to last', price: '$69', detail: 'A sturdier finish for the cabinet you use every day.' };
  return { type: 'none' };
}

function showView(view) {
  const home = document.querySelector('#home-view');
  const product = document.querySelector('#product-view');
  home.hidden = view !== 'home';
  product.hidden = view !== 'product';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showNotice(message) {
  const notice = document.querySelector('#notice');
  notice.textContent = message;
  notice.classList.add('is-visible');
  window.setTimeout(() => notice.classList.remove('is-visible'), 2600);
}

if (typeof document !== 'undefined') {
  document.querySelectorAll('[data-open-product]').forEach((element) => {
    element.addEventListener('click', () => showView(resolveAction('open-product').view));
  });

  document.querySelectorAll('[data-researching]').forEach((element) => {
    element.addEventListener('click', () => showNotice(resolveAction('researching').message));
  });

  document.querySelectorAll('[data-go-home]').forEach((element) => {
    element.addEventListener('click', () => showView('home'));
  });

  document.querySelectorAll('[data-scroll-to]').forEach((element) => {
    element.addEventListener('click', () => {
      document.querySelector(`#${element.dataset.scrollTo}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  document.querySelectorAll('[data-plan]').forEach((element) => {
    element.addEventListener('click', () => {
      const plan = resolveAction(element.dataset.plan);
      document.querySelectorAll('[data-plan]').forEach((button) => button.classList.toggle('is-active', button === element));
      document.querySelector('#plan-title').textContent = plan.title;
      document.querySelector('#plan-price').textContent = plan.price;
      document.querySelector('#plan-detail').textContent = plan.detail;
    });
  });
}
