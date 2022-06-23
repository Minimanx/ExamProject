<script>
    export let theaters;
	export let teleportToTheater = () => {};

    let sortBySpacesPicker = 0;
    let sortByNamePicker = 0;
    let sortByTimePicker = 0;
    let sortByDatePicker = 0;
    const colors = ["color: black;", "color: red;", "color: green;"]

    function sortByName() {
        sortBySpacesPicker = 0;
        sortByTimePicker = 0;
        sortByDatePicker = 0;

        if(sortByNamePicker === 0 || sortByNamePicker === 1) {
			theaters.sort((a, b) => {
				if(a.eventName > b.eventName) {
					return 1;
				}
				if(a.eventName < b.eventName) {
					return -1;
				}
			});
            sortByNamePicker = 2;
		} else {
			theaters.sort((a, b) => {
				if(a.eventName < b.eventName) {
					return 1;
				}
				if(a.eventName > b.eventName) {
					return -1;
				}
			});
            sortByNamePicker = 1;
		}
        theaters = theaters;
    }
    function sortBySpaces() {
        sortByNamePicker = 0;
        sortByTimePicker = 0;
        sortByDatePicker = 0;

        if(sortBySpacesPicker === 0 || sortBySpacesPicker === 1) {
            theaters.sort((a, b) => {
                return a.amountOfSpaces - b.amountOfSpaces;
            });
            sortBySpacesPicker = 2;
        } else {
            theaters.sort((a, b) => {
                return b.amountOfSpaces - a.amountOfSpaces;
            });
            sortBySpacesPicker = 1;
        }
        theaters = theaters;
    }
    function sortByTime() {
        sortBySpacesPicker = 0;
        sortByNamePicker = 0;
        sortByDatePicker = 0;

        if(sortByTimePicker === 0 || sortByTimePicker === 1) {
            theaters.sort((a, b) => {
                return b.movieRuntime - a.movieRuntime;
            });
            sortByTimePicker = 2;
        } else {
            theaters.sort((a, b) => {
                return a.movieRuntime - b.movieRuntime;
            });
            sortByTimePicker = 1;
        }
        theaters = theaters;
    }
    function sortByDate() {
        sortBySpacesPicker = 0;
        sortByNamePicker = 0;
        sortByTimePicker = 0;

        if(sortByDatePicker === 0 || sortByDatePicker === 1) {
            theaters.sort((a, b) => {
                return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
            });
            sortByDatePicker = 2;
        } else {
            theaters.sort((a, b) => {
                return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
            });
            sortByDatePicker = 1;
        }
        theaters = theaters;
    }
</script>

<div class="container">
    <div class="headers">
        <ul class="unorderedListHeaders">
            <li></li>
            <li on:click={sortByName} style="{colors[sortByNamePicker]}">
                Name/Movie
            </li>
            <li on:click={sortByTime} style="{colors[sortByTimePicker]}">
                Time
            </li>
            <li on:click={sortByDate} style="{colors[sortByDatePicker]}">
                Starts
            </li>
            <li on:click={sortBySpaces}>
                <svg fill="{colors[sortBySpacesPicker].split(" ")[1].split(";")[0]}" width=22px xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512"><!--! Font Awesome Pro 6.1.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M224 256c70.7 0 128-57.31 128-128S294.7 0 224 0C153.3 0 96 57.31 96 128S153.3 256 224 256zM274.7 304H173.3c-95.73 0-173.3 77.6-173.3 173.3C0 496.5 15.52 512 34.66 512H413.3C432.5 512 448 496.5 448 477.3C448 381.6 370.4 304 274.7 304zM479.1 320h-73.85C451.2 357.7 480 414.1 480 477.3C480 490.1 476.2 501.9 470 512h138C625.7 512 640 497.6 640 479.1C640 391.6 568.4 320 479.1 320zM432 256C493.9 256 544 205.9 544 144S493.9 32 432 32c-25.11 0-48.04 8.555-66.72 22.51C376.8 76.63 384 101.4 384 128c0 35.52-11.93 68.14-31.59 94.71C372.7 243.2 400.8 256 432 256z"/></svg>
            </li>
            <li>
                <svg width=20px xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--! Font Awesome Pro 6.1.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M80 192V144C80 64.47 144.5 0 224 0C303.5 0 368 64.47 368 144V192H384C419.3 192 448 220.7 448 256V448C448 483.3 419.3 512 384 512H64C28.65 512 0 483.3 0 448V256C0 220.7 28.65 192 64 192H80zM144 192H304V144C304 99.82 268.2 64 224 64C179.8 64 144 99.82 144 144V192z"/></svg>
            </li>
        </ul>
    </div>
    <div class="list">
        {#each theaters as theater (theater._id)}
            <ul class="unorderedList" on:click={() => teleportToTheater(theater.position)}>
                <li></li>
                <div class="names">
                    <li class="namesInsideDiv">
                        {theater.eventName}
                    </li>
                    <li class="namesInsideDiv movieName">
                        {theater.movieName}
                    </li>
                </div>
                <div class="eventInfo">
                    <div class="eventInfoSingle">
                        <li>
                            {theater.movieRuntime}
                        </li>
                        <li>
                            min
                        </li>
                    </div>
                    <div class="eventInfoSingle">
                        <li>
                            {(new Date(theater.startTime).getHours() < 10 ? "0" : "") + new Date(theater.startTime).getHours()}:{(new Date(theater.startTime).getMinutes() < 10 ? "0" : "") + new Date(theater.startTime).getMinutes()}
                        </li>
                    </div>
                    <div class="eventInfoSingle">
                        <li>
                            {theater.usersInsideTheater.length}/{theater.amountOfSpaces}
                        </li>
                    </div>
                    <div class="eventInfoSingle">
                        <li>
                            {#if theater.passwordBool}
                                <svg width=22px xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--! Font Awesome Pro 6.1.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M80 192V144C80 64.47 144.5 0 224 0C303.5 0 368 64.47 368 144V192H384C419.3 192 448 220.7 448 256V448C448 483.3 419.3 512 384 512H64C28.65 512 0 483.3 0 448V256C0 220.7 28.65 192 64 192H80zM144 192H304V144C304 99.82 268.2 64 224 64C179.8 64 144 99.82 144 144V192z"/></svg>
                            {:else}
                                <svg fill="#646464" width=22px xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--! Font Awesome Pro 6.1.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M144 192H384C419.3 192 448 220.7 448 256V448C448 483.3 419.3 512 384 512H64C28.65 512 0 483.3 0 448V256C0 220.7 28.65 192 64 192H80V144C80 64.47 144.5 0 224 0C281.5 0 331 33.69 354.1 82.27C361.7 98.23 354.9 117.3 338.1 124.9C322.1 132.5 303.9 125.7 296.3 109.7C283.4 82.63 255.9 64 224 64C179.8 64 144 99.82 144 144L144 192z"/></svg>
                            {/if}
                        </li>
                    </div>
                </div>
            </ul>
        {/each}
    </div>
</div>

<style>
    .unorderedListHeaders {
        flex-basis: 261px;
        flex-shrink: 0;
        display: flex;
        margin: 0;
        text-align: center;
        list-style-type: none;
        padding: 10px 0px;
        align-items: center;
    }
    .unorderedListHeaders li:hover {
        cursor: pointer;
    }
    .unorderedListHeaders li:nth-child(1) {
        flex-basis: 26px;
    }
    .unorderedListHeaders li:nth-child(2) {
        flex-basis: 188px;
    }
    .unorderedListHeaders li:nth-child(3) {
        flex-basis: 84px;
    }
    .unorderedListHeaders li:nth-child(4) {
        flex-basis: 69px;
    }
    .unorderedListHeaders li:nth-child(5) {
        flex-basis: 95px;
    }
    .unorderedListHeaders li:nth-child(6) {
        flex-basis: 35px;
    }
    .list {
        width: 100%;
        overflow-y: auto;
        -ms-overflow-style: none;
        scrollbar-width: none;
    }
    .list::-webkit-scrollbar {
        display: none;
    }
    .headers {
        width: 100%;
        font-size: 11px;
        border-bottom: 3px solid black;
    }
    .movieName {
        font-size: 12px;
    }
    .namesInsideDiv {
        width: 100%;
        text-overflow: ellipsis;
        overflow: hidden;
    }
    .names {
        width: 40%;
        white-space: nowrap;
    }
    .eventInfoSingle {
        flex-basis: 70px;
        flex-shrink: 0;
    }
    .eventInfo div:first-child {
        flex-basis: 46px;
    }
    .eventInfo div:nth-child(4) {
        flex-basis: 35px;
    }
    .eventInfo {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 12px;
        flex-shrink: 0;
        flex-basis: 255px;
    }
    .container {
        display: flex;
        flex-direction: column;
        width: 497px;
        align-items: center;
        height: 640px;
        position: fixed;
        top: 80px;
        font-size: 14px;
    }
    .unorderedList {
        width: 100%;
        margin: 0;
        text-align: center;
        list-style-type: none;
        padding: 10px 0px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        line-height: 20px;
        gap: 20px;
    }
    .unorderedList:nth-child(even) {
        background-color: rgb(228, 228, 228);
    }
    .unorderedList:hover {
        background-color: aquamarine;
        cursor: pointer;
    }
    li {
        user-select: none;
    }
</style>