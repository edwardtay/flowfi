export type X402PaymentDetails = {
  amount: string
  token: string
  chain: string
  recipient: string
}

export async function probeX402(url: string): Promise<X402PaymentDetails | null> {
  try {
    const res = await fetch(url)
    if (res.status === 402) {
      const body = await res.json().catch(() => null)
      if (body && body.payment) {
        return body.payment as X402PaymentDetails
      }
      // Try header-based approach
      const payHeader = res.headers.get('X-Payment')
      if (payHeader) {
        return JSON.parse(payHeader) as X402PaymentDetails
      }
    }
    return null
  } catch {
    return null
  }
}

export async function accessWithPayment(url: string, paymentProof: string): Promise<{ status: number; data: unknown }> {
  const res = await fetch(url, {
    headers: { 'X-Payment-Proof': paymentProof },
  })
  const data = await res.json().catch(async () => ({ message: await res.text() }))
  return { status: res.status, data }
}
