# Email di GoalFit nel nuovo stile

Questi due file vanno incollati a mano nel pannello di Supabase, perché le email automatiche si configurano lì e non dal codice.

1. Apri supabase.com, entra nel progetto di GoalFit.
2. Vai su Authentication, poi Emails (o Email Templates).
3. In "Confirm signup" incolla il contenuto di `conferma-account.html`. Oggetto consigliato: "Conferma il tuo account GoalFit".
4. In "Reset password" incolla il contenuto di `recupero-password.html`. Oggetto consigliato: "Reimposta la password di GoalFit".
5. Salva.

Non cambiare la scritta `{{ .ConfirmationURL }}`: è il segnaposto che Supabase sostituisce con il link vero.
