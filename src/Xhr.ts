interface XhrOptions {
    method?: string;
    success?: (response: any) => void;
    progress?: (total: number, loaded: number) => void;
    fail?: (url: string, status: number, message: string) => void;
    data?: string;
    responseType?: XMLHttpRequestResponseType;
}

export class Xhr {

    private resource: string;
    private options: XhrOptions;
    private xhr: XMLHttpRequest | null = null;
    private total: number = 0;
    private loaded: number = 0;

    constructor(url: string, options: XhrOptions) {
        this.resource = url;
        this.options = options;
        this.options.method = options.method || "GET";

        if (this.options.method  === "GET") {
                this.makeHttpRequest();
        }
    }

    private makeHttpRequest() {
        this.xhr = new XMLHttpRequest();
        this.xhr.open(this.options.method || "GET", this.resource, true);
        if (this.options.method === "POST") {
            this.xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        }
        this.xhr.overrideMimeType("text/plain; charset=x-user-defined");

        let progressListner;
        if (typeof (progressListner = this.xhr).addEventListener === "function") {
            progressListner.addEventListener("progress", (evt) => {
                this.total = evt.total;
                this.loaded = evt.loaded;
                if (this.options.progress) {
                    return this.options.progress(evt.total, evt.loaded);
                }
            });
        }

        let errorListener;
        if (typeof (errorListener = this.xhr).addEventListener === "function") {
            errorListener.addEventListener("error", (evt) => {
                if (this.options.fail) {
                    this.options.fail(this.resource, (this.xhr as XMLHttpRequest).status, "connection problem");
                    return delete this.options.fail;
                }
            });
        }
        this.xhr.onreadystatechange = () => {
            return this.onReadyStateChange();
        };
        if (this.options.responseType) {
            this.xhr.responseType = this.options.responseType;
        }
        this.xhr.send(this.options.data);
    }

    private onReadyStateChange() {
        const xhr = (this.xhr as XMLHttpRequest);
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                if (this.options.success) {
                    const total = Math.max(this.total, this.loaded);
                    if (this.options.progress !== undefined) {
                        this.options.progress(total, total);
                    }

                    return this.options.success(xhr.response);
                }
            } else if (this.options.fail) {
                this.options.fail(this.resource, xhr.status, "connection problem");
                return delete this.options.fail;
            }
        }
    }

}
