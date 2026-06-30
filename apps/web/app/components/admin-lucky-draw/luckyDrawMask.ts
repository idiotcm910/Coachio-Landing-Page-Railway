/** Che bớt thông tin liên hệ người trúng giải để bảo mật khi trình chiếu. */

/** SĐT: chỉ hiện 3 số cuối, phần còn lại thay bằng dấu chấm. VD 0000000068 → •••••••068 */
export function maskPhone(phone?: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 3) return phone;
  return `${'•'.repeat(digits.length - 3)}${digits.slice(-3)}`;
}

/** Email: chỉ hiện 2 chữ cái đầu, che phần còn lại của tên + tên miền. VD test68@example.com → te•••@•••••• */
export function maskEmail(email?: string | null): string {
  if (!email) return '';
  const at = email.indexOf('@');
  if (at < 0) {
    const head = email.slice(0, 2);
    return `${head}${'•'.repeat(Math.max(1, email.length - head.length))}`;
  }
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const head = local.slice(0, 2);
  return `${head}${'•'.repeat(Math.max(1, local.length - head.length))}@${'•'.repeat(Math.max(1, domain.length))}`;
}
