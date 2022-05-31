import { toast } from "@zerodevx/svelte-toast";

const success = (m) => {
    toast.pop();
    toast.push(m, {
        theme: {
            '--toastBackground': 'green',
            '--toastColor': 'white',
            '--toastBarBackground': 'olive'
        }
    });
};

const error = (m) => {
    toast.pop();
    toast.push(m, {
        theme: {
            '--toastBackground': '#F56565',
            '--toastBarBackground': '#C53030'
        }
    });
};


export { error, success };