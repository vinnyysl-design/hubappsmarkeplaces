/** Shared UI/backend response contract; no credentials, transport or global state. */
export function accessState(profile) {
  if (!profile || !['ativo','bloqueado'].includes(profile.status) ||
      ![true,false,null].includes(profile.administrative_blocked) ||
      typeof profile.financial_blocked !== 'boolean') throw Error('ACCESS_STATE_UNCONFIRMED');
  const administrative = profile.administrative_blocked !== false;
  const blocked = administrative || profile.financial_blocked;
  if (profile.status !== (blocked ? 'bloqueado' : 'ativo')) throw Error('ACCESS_STATE_INCONSISTENT');
  return {hubAllowed:true,toolsAllowed:!blocked,administrative,
    legacyReview:profile.administrative_blocked===null,financial:profile.financial_blocked};
}

/** Used only on server-lookup responses, NEVER directly on webhook event body. */
export function verifiedPayment(resource, payment, expected) {
  if (!resource || !payment || !expected || !expected.userId || !expected.preapprovalId ||
      String(resource.preapproval_id)!==expected.preapprovalId ||
      String(resource.payment?.id)!==String(payment.id) ||
      !resource.id || payment.status!=='approved' || !payment.date_approved ||
      !Number.isFinite(Number(payment.transaction_amount)) || Number(payment.transaction_amount)<0 ||
      !/^\d{4}-\d{2}-\d{2}T/.test(payment.date_approved)) throw Error('CONFIRMED_PAYMENT_REQUIRED');
  if (String(payment.currency_id)!=='BRL') throw Error('PAYMENT_CURRENCY_MISMATCH');
  // Caller must have bound preapproval to expected.userId via server lookup,
  // exact external_reference ownership and the existing account's MP token.
  return {userId:expected.userId,paymentId:String(payment.id),authorizedId:String(resource.id),
    preapprovalId:expected.preapprovalId,paidAt:payment.date_approved.slice(0,10),
    amount:Number(payment.transaction_amount)};
}

/** Real callback orchestration; transports are injected for offline testing.
 * Fetches BOTH current authorized_payment and underlying payment from provider.
 * A preapproval, processed flag, browser redirect or failed insert never grants.
 */
export async function confirmProviderPayment(port, resourceId) {
  const resource=await port.fetchAuthorized(String(resourceId));
  if (String(resource?.id)!==String(resourceId)) throw Error('RESOURCE_ID_MISMATCH');
  const binding=await port.resolveOwnedPreapproval(String(resource?.preapproval_id??''));
  if (!resource?.payment?.id) throw Error('CONFIRMED_PAYMENT_REQUIRED');
  const payment=await port.fetchPayment(String(resource.payment.id));
  const confirmed=verifiedPayment(resource,payment,binding);
  return await port.applyConfirmedPayment(confirmed);
}

export async function loadHubAndTools(port,uid) {
  const result=await port.enforceOwn(uid);
  const profile=await port.readOwn(uid);
  if(profile?.id!==uid || result?.status!==profile.status) throw Error('ACCESS_IDENTITY_MISMATCH');
  return {...accessState(profile),profile};
}
