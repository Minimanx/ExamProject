<script>
    import { error, success } from "../components/toasts/toastThemes.js";
    import { user } from "../stores/userStore.js";
    import { playerMovement } from "../stores/stateManagementStore.js";

    export let socket;

    let email;
    let username;
    let password;
    let passwordRepeat;
    let token;

    let loginComponent = true;
    let signUpComponent = false;
    let forgotPassComponent = false;
    let tokenComponent = false;
    let changePassComponent = false;

    async function login() {
        const response = await fetch("/login", {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
                email: email,
                password: password,
            }),
		});

        const result = await response.json();

        if(response.status === 400) {
            error(result.message);
            return;
        }
        if(response.status === 200) {
            $user.loggedIn = true;
            $user.username = result.data.username;
            $user.userID = result.data._id;
            $user.playerColor = "#" + Math.floor(Math.random()*16777215).toString(16);
            $user.insideTheater = false;
            $playerMovement = true;
            socket.emit("carUpdate", { name: result.data.username, color: $user.playerColor });
            success(result.message);
        }

    }

    async function signUp() {
		const response = await fetch("/users", {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
                email: email,
                username: username,
                password: password,
                passwordRepeat: passwordRepeat
            }),
		});

        const result = await response.json();

        if(response.status === 400) {
            error(result.message);
            return;
        }
        if(response.status === 200) {
            success(result.message);
            changeToLogin();
        }
    }

    async function forgotPass() {
		const response = await fetch("/forgotpassword", {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
                email: email
            }),
		});

        const result = await response.json();

        if(response.status === 400) {
            error(result.message);
            return;
        }

        success(result.message);
        changeToToken(email);
    }

    async function confirmToken() {
		const response = await fetch("/resetpassword", {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
                email: email,
                token: token
            }),
		});

        const result = await response.json();

        if(response.status === 400) {
            error(result.message);
            return;
        }

        changeToChangePass(email, token);
    }

    async function changePass() {
		const response = await fetch("/resetpassword", {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
                email: email,
                token: token,
                password: password,
                passwordRepeat: passwordRepeat
            }),
		});

        const result = await response.json();

        if(response.status === 400) {
            error(result.message);
            return;
        }
        if(response.status === 200) {
            success(result.message);
            changeToLogin();
        }
        
    }

    function changeToLogin() {
        loginComponent = true;
        signUpComponent = false;
        forgotPassComponent = false;
        tokenComponent = false;
        changePassComponent = false;
        resetInputs();
    }

    function changeToSignUp() {
        loginComponent = false;
        signUpComponent = true;
        forgotPassComponent = false;
        tokenComponent = false;
        changePassComponent = false;
        resetInputs();
    }

    function changeToForgot() {
        loginComponent = false;
        signUpComponent = false;
        forgotPassComponent = true;
        tokenComponent = false;
        changePassComponent = false;
        resetInputs();
    }

    function changeToToken(tokenEmail) {
        loginComponent = false;
        signUpComponent = false;
        forgotPassComponent = false;
        tokenComponent = true;
        changePassComponent = false;
        resetInputs();
        email = tokenEmail;
    }

    function changeToChangePass(tokenEmail, passwordToken) {
        loginComponent = false;
        signUpComponent = false;
        forgotPassComponent = false;
        tokenComponent = false;
        changePassComponent = true;
        resetInputs();
        email = tokenEmail;
        token = passwordToken;
    }

    function resetInputs() {
        email = "";
        username = "";
        password = "";
        passwordRepeat = "";
        token = "";
    }
</script>

{#if loginComponent === true}
    <div class="container">
        <label for="email">Email</label>
        <input name="email" type="email" bind:value={email} placeholder="Type email here...">
        <label for="password">Password</label>
        <input name="password" type="password" bind:value={password} placeholder="Type password here..." maxlength="24">
        <button id="mainbutton" on:click={login}>Login</button>
        <div class="otherOptions">
            <button on:click={changeToSignUp}>Sign Up</button>
            <button on:click={changeToForgot}>Forgot Password</button>
        </div>
    </div>
{/if}
{#if signUpComponent === true}
    <div class="container">
        <label for="email">Email</label>
        <input name="email" type="email" bind:value={email} placeholder="Type email here...">
        <label for="username">Username</label>
        <input name="username" type="text" bind:value={username} placeholder="Type username here..." maxlength="16">
        <label for="password">Password</label>
        <input name="password" type="password" bind:value={password} placeholder="Type password here..." maxlength="24">
        <label for="passwordRepeat">Repeat Password</label>
        <input name="passwordRepeat" type="password" bind:value={passwordRepeat} placeholder="Type password here..." maxlength="24">
        <button id="mainbutton" on:click={signUp}>Create Account</button>
        <div class="otherOptions">
            <button on:click={changeToLogin}>Back</button>
        </div>
    </div>
{/if}
{#if forgotPassComponent === true}
    <div class="container">
        <label for="email">Email</label>
        <input name="email" type="email" bind:value={email} placeholder="Type email here...">
        <button id="mainbutton" on:click={forgotPass}>Click here to reset password</button>
        <div class="otherOptions">
            <button on:click={changeToLogin}>Back</button>
        </div>
    </div>
{/if}
{#if tokenComponent === true}
    <div class="container">
        <label for="token">Email Code</label>
        <input name="token" type="text" bind:value={token} placeholder="Type code from email here...">
        <button id="mainbutton" on:click={confirmToken}>Click here to confirm</button>
        <div class="otherOptions">
            <button on:click={changeToLogin}>Back</button>
        </div>
    </div>
{/if}
{#if changePassComponent === true}
    <div class="container">
        <label for="password">Password</label>
        <input name="password" type="password" bind:value={password} placeholder="Type password here..." maxlength="24">
        <label for="passwordRepeat">Repeat Password</label>
        <input name="passwordRepeat" type="password" bind:value={passwordRepeat} placeholder="Type password here..." maxlength="24">
        <button id="mainbutton" on:click={changePass}>Change Password</button>
        <div class="otherOptions">
            <button on:click={changeToLogin}>Back</button>
        </div>
    </div>
{/if}

<style>
    button:hover {
        background-color: aquamarine;
        cursor: pointer;
    }
    #mainbutton {
        width: 85%;
        height: 60px;
    }
    .otherOptions {
        width: 85%;
        display: flex;
        justify-content: space-between;
    }
    input {
        height: 50px;
        width: 85%;
        border-radius: 5px;
    }
    input:focus {
        outline-color: rgb(104, 104, 104);
    }
    input::placeholder {
        font-size: 0.7em;
    }
    label {
        font-size: 1.2em;
        line-height: 2;
    }
    button {
        border-radius: 5px;
        width: 45%;
    }
    .container {
        position: fixed;
        padding: 1%;
        top: 50%;
        left: 50%;
        width: 400px;
        height: 350px;
        transform: translate(-50%, -50%);
        background-color: rgb(252, 252, 252);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        border-radius: 20px;
        border: 5px solid rgb(233, 233, 233);
    }
</style>