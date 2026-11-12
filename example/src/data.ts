export type Mail = {
  id: string;
  from: string;
  subject: string;
  preview: string;
  lines: number;
  disabled?: boolean;
};

const senders = ['Anna', 'Boris', 'Vika', 'Gleb', 'Dasha', 'Egor', 'Jane', 'Ilya'];
const subjects = ['Weekly report', 'Call at 3 pm', 'Invoice #482', 'Vacation plans', 'PR review', 'New design'];

export const makeMails = (count: number, withDisabled = false): Mail[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `mail-${i}`,
    from: senders[i % senders.length]!,
    subject: `${subjects[i % subjects.length]} #${i + 1}`,
    preview: 'Message preview that takes one or several lines depending on the email. '.repeat(1 + (i % 4)),
    lines: 1 + (i % 4),
    disabled: withDisabled && i % 7 === 3,
  }));

export type Photo = { id: string; color: string };

export const makePhotos = (count: number): Photo[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `photo-${i}`,
    color: `hsl(${(i * 37) % 360}, 60%, ${55 + (i % 3) * 8}%)`,
  }));
