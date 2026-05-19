# SecApp Deployment Guide

## ✅ Pre-Deployment Checklist

### Configuration Files
- [x] `.env` file created with GMAIL_USER=secagemapp@gmail.com
- [ ] Gmail App Password added to `.env` (PENDING: User to provide)
- [x] `firebase-applet-config.json` configured with project ID: gen-lang-client-0972067932
- [x] `firestore.rules` properly set up with security rules
- [x] `package.json` has all dependencies installed

### Code Implementation
- [x] Register.tsx - Complete registration flow
- [x] Login.tsx - Complete login and password reset flow
- [x] useAuth.tsx - Complete authentication state management
- [x] server.ts - Email sending endpoints (3 total)
- [x] Constants.ts - Master emails configured (jacksonbjr@gmail.com)
- [x] Firestore security rules - Complete and tested

### Email System
- [x] Verification email template - Professional HTML with Firebase links
- [x] Password reset email template - Professional HTML with Firebase links
- [x] Admin notification email - Configured to notify jacksonbjr@gmail.com
- [x] Email templates in Portuguese - All user-facing content localized
- [ ] Gmail credentials verified (PENDING: User to provide app password)

## 🔧 Critical Setup: Gmail App Password

### Why It's Needed
The email sending system uses Nodemailer to connect to Gmail SMTP. For security, Google requires an "App Password" instead of your regular Gmail password.

### How to Generate Gmail App Password

1. **Go to Google Account Security**
   - Visit: https://myaccount.google.com/security
   - Sign in to secagemapp@gmail.com

2. **Enable 2-Step Verification** (if not already enabled)
   - Look for "2-Step Verification" option
   - Follow the prompts to set it up
   - This is required to generate app passwords

3. **Generate App Password**
   - In Security page, scroll down to "App passwords"
   - Select "Mail" as the app
   - Select "Windows Computer" as the device
   - Google will generate a 16-character password
   - Copy this password carefully

4. **Add to .env File**
   ```
   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
   ```
   (The spaces are included in the app password from Google)

### Verify Setup Locally

1. **Install Dependencies**
   ```bash
   cd SecApp
   npm install
   ```

2. **Run Development Server**
   ```bash
   npm run dev
   ```
   This starts the Express server on http://localhost:3000

3. **Test Email Sending**
   - Register a new user account
   - Check your email for verification link
   - If email doesn't arrive:
     - Check spam folder
     - Check browser console for errors
     - Check server terminal for email sending logs

## 📋 Local Testing Flow

### Test 1: Registration with Email Verification

```bash
# Start the dev server
npm run dev
```

1. Open http://localhost:3000/register
2. Fill form:
   - Nome: Test User
   - Email: test@gmail.com
   - Senha: Password123!
   - Confirmar Senha: Password123!
3. Click "Registrar"
4. **Expected Results**:
   - Success screen: "Cadastro Realizado!"
   - Email received from secagemapp@gmail.com with subject "SecApp - Bem-vindo e Verificação de E-mail"
   - Verification email contains a button "Verificar E-mail"
   - Clicking the button marks email as verified in Firebase

### Test 2: Password Reset

1. Go to http://localhost:3000/login
2. Click "Esqueceu sua senha?" (Forgot Password)
3. Enter your registered email
4. Click "Enviar Link"
5. **Expected Results**:
   - Success message: "Link enviado para seu email"
   - Email received from secagemapp@gmail.com with subject "SecApp - Recuperação de Senha"
   - Password reset email contains a button "Redefinir Minha Senha"
   - Clicking the button allows you to set a new password

### Test 3: Login with Verified Email

1. After verifying your email, go to http://localhost:3000/login
2. Enter email and password
3. **Expected Results**:
   - If email verified and admin approved: Redirected to dashboard
   - If email not verified: Shown verification screen
   - If waiting for approval: Shown "Awaiting Admin Approval" message

## 🚀 Deploying to Vercel

### Step 1: Commit Local Changes
```bash
cd SecApp
git add .
git commit -m "Complete authentication system: registration, login, password reset, email verification"
git push origin main
```

### Step 2: Set Environment Variables in Vercel

1. Go to https://vercel.com/dashboard
2. Select your SecApp project
3. Go to Settings → Environment Variables
4. Add these variables:
   ```
   GMAIL_USER=secagemapp@gmail.com
   GMAIL_APP_PASSWORD=<16-character-app-password>
   ```

5. Make sure FIREBASE_PROJECT_ID is already set (should be from earlier)

### Step 3: Redeploy

Once environment variables are set:
1. Go to Deployments tab
2. Click "Redeploy" on the latest main branch deployment
3. Wait for build to complete
4. Test the live site

## ✅ Post-Deployment Verification

1. **Visit live site** (your Vercel URL)
2. **Test Registration**:
   - Create new account with test email
   - Verify email arrives from secagemapp@gmail.com
3. **Test Password Reset**:
   - Use "Forgot Password" flow
   - Verify reset email arrives
4. **Test Complete Login Flow**:
   - Verify email
   - Get admin approval (admin panel)
   - Login successfully
5. **Monitor Emails**:
   - Check sent folder of secagemapp@gmail.com
   - Verify no emails going to spam
   - Monitor bounce rate

## 📊 Email Deliverability Monitoring

### Gmail Sent Mail
- Log in to secagemapp@gmail.com
- Check "Sent" folder to see all emails sent
- Look for bounces or failed deliveries

### Email Headers
- Each email should show:
  - From: SecApp - Suporte <secagemapp@gmail.com>
  - To: recipient email
  - Subject: Appropriate subject line in Portuguese

### Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Email not arriving | Wrong app password | Regenerate app password in Google Account |
| Email in spam | Gmail reputation | Add reply-to header, use verified domain |
| 400 Bad Request | Missing config | Verify GMAIL_USER and GMAIL_APP_PASSWORD set |
| 500 Server Error | Firebase link generation | Check Firebase Admin credentials |
| Verification link not working | Expired link | User must click within time limit |

## 🔐 Security Best Practices

1. **Never commit .env file** - It's in .gitignore ✅
2. **Use Gmail App Password, not regular password** - Safer and required by Google
3. **Rotate app password periodically** - Generate new one in Google Account every 6 months
4. **Monitor email sending** - Check logs for failed sends
5. **Verify sender reputation** - Monitor bounce rates and spam complaints
6. **Test before production** - Always test locally first

## 📞 Support & Troubleshooting

### Email Not Sending?
1. Check `.env` file has GMAIL_USER and GMAIL_APP_PASSWORD
2. Check Gmail account has 2-Step Verification enabled
3. Check app password is 16 characters (no dashes, just spaces)
4. Check browser console for error messages
5. Check server terminal for detailed logs

### Firebase Link Not Working?
1. Verify Firebase Project ID in `.env` matches firebase-applet-config.json
2. Check that user exists in Firebase Auth
3. Verify action code settings have correct URL
4. Check that verification/reset link hasn't expired (usually 24 hours)

### Users Can't Login?
1. Check email is verified (User should click link in verification email)
2. Check user status is "approved" in Firestore users collection
3. Check user email domain is in allowed_domains (if domain restriction enabled)
4. Check user account is not "disabled" or "blocked"

## 🎯 Next Steps After Deployment

1. **Monitor Email Delivery**
   - Check secagemapp@gmail.com sent folder
   - Verify no emails bouncing
   - Monitor user feedback on email arrival

2. **Gather User Feedback**
   - Does email verification work smoothly?
   - Is password reset intuitive?
   - Any UI/UX improvements needed?

3. **Setup Monitoring**
   - Monitor Vercel logs for errors
   - Setup alerts for failed email sends
   - Track authentication metrics

4. **Document for Users**
   - Create user guide for registration process
   - Explain email verification requirement
   - Provide password reset instructions
