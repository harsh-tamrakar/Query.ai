const res = await fetch("http://localhost:3000/payments/webhook", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    orderId: "order_27bf4ad07377",
    razorpay_payment_id: "pay_test_123"
  })
});

console.log("RESPONSE STATUS:", res.status);
console.log("RESPONSE BODY:", await res.json());
process.exit(0);
