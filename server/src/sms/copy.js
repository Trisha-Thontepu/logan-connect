import { minutesToClock } from '../lib/hours.js';
import { formatPhone } from '../lib/phone.js';

// All customer-facing text, in one place so English and Spanish stay in step.

const SPANISH_HINTS =
  /\b(hola|buenas|buenos|cita|quiero|necesito|cuando|cuándo|disponible|gracias|hoy|mañana|manana|servicio|precio|uñas|unas|por favor|ayuda|cancelar|jueves|viernes|sábado|sabado|domingo|lunes|martes|miércoles|miercoles)\b|[ñáéíóú¿¡]/i;

export function detectLang(text) {
  return SPANISH_HINTS.test(text) ? 'es' : 'en';
}

const GREETING_RE = /^(hi|hello|hey|hola|buenas|buenos dias|buenas tardes|buenas noches|good morning|good afternoon|start|empezar)\W*$/i;
export const isGreeting = (text) => GREETING_RE.test(text.trim());

export function fmtWhen(dt, lang) {
  return lang === 'es'
    ? dt.setLocale('es').toFormat("cccc d 'de' LLL 'a las' h:mm a")
    : dt.setLocale('en-US').toFormat("cccc, LLL d 'at' h:mm a");
}
export function fmtDay(dt, lang) {
  return lang === 'es' ? dt.setLocale('es').toFormat("cccc d 'de' LLL") : dt.setLocale('en-US').toFormat('cccc, LLL d');
}
const fmtSlots = (slots, lang) => slots.map((s) => fmtWhen(s, lang)).join('; ');
const name = (s, lang) => (lang === 'es' && s.name_es) || s.name_en;
const price = (s) => (s.price_cents ? ` ($${Math.round(s.price_cents / 100)})` : '');
const list = (services, lang) => services.map((s) => `${name(s, lang)}${price(s)}`).join(', ');
const closedDayName = (dt, lang) => dt.setLocale(lang === 'es' ? 'es' : 'en-US').toFormat('cccc');

const COPY = {
  en: {
    greeting: (b) => `Hi! This is ${b.name}. Text the service and a day/time, like "gel manicure Thursday 3pm". Reply HELP for more options.`,
    noService: (svcs) => `I didn't catch which service. We offer: ${list(svcs, 'en')}. Which one would you like?`,
    ambiguous: (svcs) => `Which one did you mean: ${list(svcs, 'en')}?`,
    askTime: (s) => `Got it: ${name(s, 'en')}. What day and time works for you? (e.g. "Friday 2pm")`,
    askDay: (s, t) => `${name(s, 'en')} at ${t.toFormat('h:mm a')}. Which day? (e.g. "Friday")`,
    askTimeForDay: (s, d) => `${name(s, 'en')} on ${fmtDay(d, 'en')}. What time? (e.g. "2pm")`,
    askService: (svcs, when) => `Sounds good for ${when}. Which service? We offer: ${list(svcs, 'en')}.`,
    confirmed: (s, dt, b) => `You're booked: ${name(s, 'en')} on ${fmtWhen(dt, 'en')} at ${b.name}, ${b.address.split(',')[0]}. Reply CANCEL APPT to cancel.`,
    closedDay: (dt, slots) => `We're closed on ${closedDayName(dt, 'en')}s.${slots.length ? ` Next openings: ${fmtSlots(slots, 'en')}.` : ''} What works?`,
    outsideHours: (range, slots) => `That time is outside our hours (${minutesToClock(range.open)} to ${minutesToClock(range.close)}).${slots.length ? ` Next openings: ${fmtSlots(slots, 'en')}.` : ''} What works?`,
    taken: (slots) => `Sorry, that time is already taken.${slots.length ? ` Next openings: ${fmtSlots(slots, 'en')}.` : ''} What works?`,
    past: (slots) => `That time has already passed.${slots.length ? ` Next openings: ${fmtSlots(slots, 'en')}.` : ''} What works?`,
    tooSoon: (slots) => `We need at least an hour of notice.${slots.length ? ` Next openings: ${fmtSlots(slots, 'en')}.` : ''} What works?`,
    tooFar: `We can only book up to 60 days ahead. Please pick an earlier date.`,
    noOpenings: (b) => `I couldn't find an opening in the next two weeks. Please call ${formatPhone(b.phone) || 'us'}.`,
    tooMany: `You already have 3 upcoming appointments. Reply CANCEL APPT to cancel the next one, or call us to change them.`,
    duplicate: (s, dt) => `You already have ${name(s, 'en')} on ${fmtWhen(dt, 'en')}. See you then!`,
    cancelled: (s, dt, more) => `Cancelled: ${name(s, 'en')} on ${fmtWhen(dt, 'en')}.${more ? ` You still have ${more} more upcoming; reply CANCEL APPT again to cancel the next.` : ' Text us anytime to book again.'}`,
    nothingToCancel: `You don't have any upcoming appointments to cancel.`,
    help: (b) => `${b.name}${b.phone ? `, ${formatPhone(b.phone)}` : ''}. Text a service and a time to book ("gel manicure Friday 2pm"), CANCEL APPT to cancel, STOP to stop texts.`,
    stopped: (b) => `You're unsubscribed and won't get more texts from ${b.name}. Reply START to opt back in.`,
    started: (b) => `Welcome back! Text ${b.name} a service and a time to book.`,
    langSet: (b) => `Okay, we'll text in English. Text ${b.name} a service and a time to book.`,
    notEnabled: (b) => `${b.name} isn't taking bookings by text yet.${b.phone ? ` Please call ${formatPhone(b.phone)}.` : ''}`,
    fallback: `Sorry, I didn't understand that. Text a service and a day/time, or HELP for options.`,
  },
  es: {
    greeting: (b) => `¡Hola! Soy ${b.name}. Escribe el servicio y un día/hora, como "manicure de gel jueves 3pm". Responde AYUDA para más opciones.`,
    noService: (svcs) => `No identifiqué el servicio. Ofrecemos: ${list(svcs, 'es')}. ¿Cuál deseas?`,
    ambiguous: (svcs) => `¿Cuál quisiste decir: ${list(svcs, 'es')}?`,
    askTime: (s) => `Perfecto: ${name(s, 'es')}. ¿Qué día y hora te funciona? (ej. "viernes 2pm")`,
    askDay: (s, t) => `${name(s, 'es')} a las ${t.toFormat('h:mm a')}. ¿Qué día? (ej. "viernes")`,
    askTimeForDay: (s, d) => `${name(s, 'es')} el ${fmtDay(d, 'es')}. ¿A qué hora? (ej. "2pm")`,
    askService: (svcs, when) => `Bien para ${when}. ¿Qué servicio? Ofrecemos: ${list(svcs, 'es')}.`,
    confirmed: (s, dt, b) => `Tu cita está confirmada: ${name(s, 'es')} el ${fmtWhen(dt, 'es')} en ${b.name}, ${b.address.split(',')[0]}. Responde CANCELAR CITA para cancelar.`,
    closedDay: (dt, slots) => `Los ${closedDayName(dt, 'es')} estamos cerrados.${slots.length ? ` Próximos horarios: ${fmtSlots(slots, 'es')}.` : ''} ¿Cuál te funciona?`,
    outsideHours: (range, slots) => `Esa hora está fuera de nuestro horario (${minutesToClock(range.open)} a ${minutesToClock(range.close)}).${slots.length ? ` Próximos horarios: ${fmtSlots(slots, 'es')}.` : ''} ¿Cuál te funciona?`,
    taken: (slots) => `Lo siento, esa hora ya está ocupada.${slots.length ? ` Próximos horarios: ${fmtSlots(slots, 'es')}.` : ''} ¿Cuál te funciona?`,
    past: (slots) => `Esa hora ya pasó.${slots.length ? ` Próximos horarios: ${fmtSlots(slots, 'es')}.` : ''} ¿Cuál te funciona?`,
    tooSoon: (slots) => `Necesitamos al menos una hora de anticipación.${slots.length ? ` Próximos horarios: ${fmtSlots(slots, 'es')}.` : ''} ¿Cuál te funciona?`,
    tooFar: `Solo podemos agendar hasta 60 días adelante. Elige una fecha más cercana.`,
    noOpenings: (b) => `No encontré espacio en las próximas dos semanas. Por favor llama al ${formatPhone(b.phone) || 'negocio'}.`,
    tooMany: `Ya tienes 3 citas próximas. Responde CANCELAR CITA para cancelar la siguiente, o llámanos para cambiarlas.`,
    duplicate: (s, dt) => `Ya tienes ${name(s, 'es')} el ${fmtWhen(dt, 'es')}. ¡Te esperamos!`,
    cancelled: (s, dt, more) => `Cancelada: ${name(s, 'es')} el ${fmtWhen(dt, 'es')}.${more ? ` Aún tienes ${more} cita(s) más; responde CANCELAR CITA otra vez para cancelar la siguiente.` : ' Escríbenos cuando quieras agendar de nuevo.'}`,
    nothingToCancel: `No tienes citas próximas para cancelar.`,
    help: (b) => `${b.name}${b.phone ? `, ${formatPhone(b.phone)}` : ''}. Escribe un servicio y una hora para agendar ("manicure de gel viernes 2pm"), CANCELAR CITA para cancelar, ALTO para no recibir mensajes.`,
    stopped: (b) => `Te diste de baja y no recibirás más mensajes de ${b.name}. Responde EMPEZAR para volver.`,
    started: (b) => `¡Bienvenida/o de nuevo! Escríbele a ${b.name} un servicio y una hora para agendar.`,
    langSet: (b) => `Listo, te escribiremos en español. Escríbele a ${b.name} un servicio y una hora para agendar.`,
    notEnabled: (b) => `${b.name} todavía no acepta citas por mensaje de texto.${b.phone ? ` Por favor llama al ${formatPhone(b.phone)}.` : ''}`,
    fallback: `Lo siento, no entendí. Escribe un servicio y un día/hora, o AYUDA para ver opciones.`,
  },
};

export const t = (lang) => COPY[lang] || COPY.en;
